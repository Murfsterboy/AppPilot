package com.apppilot.companyready

import android.graphics.Typeface
import android.os.Bundle
import android.widget.TextView

class QuizActivity : BaseActivity() {
    private lateinit var step: Step
    private lateinit var progress: Progress
    private var q = 0
    private var correct = 0
    private var chosen = -1

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        progress = Progress(this)
        step = Journey.step(intent.getStringExtra("step") ?: Journey.steps.first().id)
        savedInstanceState?.let { q = it.getInt("q"); correct = it.getInt("correct"); chosen = it.getInt("chosen", -1) }
        render()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putInt("q", q); outState.putInt("correct", correct); outState.putInt("chosen", chosen)
    }

    private fun render() {
        content.removeAllViews()
        if (q >= step.quiz.size) { results(); return }
        val question = step.quiz[q]
        setTitles("Quiz: ${step.title}", "Question ${q + 1} of ${step.quiz.size}")
        progressBar(content, q.toFloat() / step.quiz.size)
        heading(question.q, size = 19f).setPadding(0, dpi(12), 0, dpi(8))

        question.options.forEachIndexed { i, opt ->
            val answered = chosen >= 0
            val c = card(onClick = if (answered) null else ({ choose(i) }))
            val isRight = i == question.answer
            val mark = when {
                answered && isRight -> "✅  "
                answered && i == chosen -> "❌  "
                else -> ""
            }
            c.addView(TextView(this).apply {
                text = mark + opt
                textSize = 16f
                setTextColor(pal.text)
                if (answered && (isRight || i == chosen)) setTypeface(typeface, Typeface.BOLD)
            })
            if (answered && isRight) c.background = rounded(pal.tipBg, dp(16f), dpi(2), pal.good)
            else if (answered && i == chosen) c.background = rounded(pal.warnBg, dp(16f), dpi(2), pal.danger)
            c.contentDescription = when {
                !answered -> "Option ${i + 1}: $opt"
                isRight -> "Correct answer: $opt"
                i == chosen -> "Your answer, incorrect: $opt"
                else -> opt
            }
        }

        if (chosen >= 0) {
            val right = chosen == question.answer
            val c = card()
            c.background = rounded(if (right) pal.tipBg else pal.warnBg, dp(16f))
            heading(if (right) "Correct!" else "Not quite", c, 17f)
            body(question.explain, c)
            primaryButton(if (q == step.quiz.size - 1) "See results" else "Next question") {
                q++; chosen = -1; render(); scroll.scrollTo(0, 0)
            }
        }
    }

    private fun choose(i: Int) {
        chosen = i
        if (i == step.quiz[q].answer) correct++
        render()
        scroll.post { scroll.fullScroll(android.view.View.FOCUS_DOWN) }
    }

    private fun results() {
        val all = correct == step.quiz.size
        setTitles("Quiz: ${step.title}", "Results")
        val c = card()
        heading(if (all) "🎉 $correct out of ${step.quiz.size} — passed!" else "$correct out of ${step.quiz.size}", c, 22f)
        if (all) {
            progress.setQuizPassed(step.id)
            body("Great work. You understand the key points of this step.", c)
            val idx = Journey.index(step.id)
            if (progress.stepComplete(step) && idx < Journey.steps.size - 1)
                body("Step ${idx + 1} is complete. Next up: **${Journey.steps[idx + 1].title}**.", c)
            else if (!progress.stepComplete(step))
                body("Tick off the remaining actions on the step page to complete it.", c, pal.subtext)
            primaryButton("Back to the step", c) { finish() }
        } else {
            body("Have another look at the lessons, then try again. You need every answer right to pass.", c)
            primaryButton("Try again", c) { q = 0; correct = 0; chosen = -1; render() }
            secondaryButton("Back to the lessons", c) { finish() }
        }
    }
}
