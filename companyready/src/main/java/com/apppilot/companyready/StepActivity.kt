package com.apppilot.companyready

import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Typeface
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.CheckBox
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView

class StepActivity : BaseActivity() {
    private lateinit var progress: Progress
    private lateinit var step: Step
    private var index = 0
    private var actionsBar: ProgressBar? = null
    private var actionsCount: TextView? = null
    private val expanded = mutableSetOf(0)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        progress = Progress(this)
        step = Journey.step(intent.getStringExtra("step") ?: Journey.steps.first().id)
        index = Journey.index(step.id)
        savedInstanceState?.getIntArray("expanded")?.let { expanded.clear(); expanded.addAll(it.toList()) }
        setTitles(step.title, "Step ${index + 1} of ${Journey.steps.size} · ${step.minutes} min")
        buildFooter()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putIntArray("expanded", expanded.toIntArray())
    }

    override fun onResume() {
        super.onResume()
        render()
    }

    private fun render() {
        val y = scroll.scrollY
        content.removeAllViews()

        body(step.summary, color = pal.subtext, size = 15f)

        sectionHeader("Learn")
        step.lessons.forEachIndexed { i, l -> lessonCard(i, l) }

        if (step.tools.isNotEmpty()) {
            sectionHeader("Use the tools")
            val c = card()
            step.tools.forEach { t -> secondaryButton(t.label, c) { openTool(t) } }
        }

        sectionHeader("Your actions")
        actionsCard()

        sectionHeader("Check your understanding")
        quizCard()

        sectionHeader("Find out more")
        val lc = card(padding = 8)
        step.links.forEach { linkRow(it, lc) }

        if (index == Journey.steps.size - 1 && progress.overallFraction() >= 1f) {
            sectionHeader("Congratulations")
            val c = card()
            c.background = rounded(pal.tipBg, dp(16f))
            heading("🎉 You've completed Company Ready UK", c)
            body("You now understand everything you need to set up and run a UK limited company: registering, paying yourself, tax and VAT, insurance, expenses, records and deadlines. Keep using Records, Deadlines and the Calculators as your company grows.", c)
        }
        scroll.post { scroll.scrollTo(0, y) }
    }

    private fun lessonCard(i: Int, l: Lesson) {
        val c = card(padding = 0)
        val head = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dpi(16), dpi(14), dpi(12), dpi(14))
            minimumHeight = dpi(52)
            isClickable = true; isFocusable = true
            background = android.graphics.drawable.RippleDrawable(ColorStateList.valueOf(pal.accent and 0x33FFFFFF), null, rounded(pal.surface, dp(16f)))
        }
        val isOpen = i in expanded
        head.addView(TextView(this).apply {
            text = l.title; textSize = 16f; setTypeface(typeface, Typeface.BOLD); setTextColor(pal.text)
        }, LinearLayout.LayoutParams(0, -2, 1f))
        head.addView(TextView(this).apply {
            text = if (isOpen) "▲" else "▼"; textSize = 12f; setTextColor(pal.subtext); setPadding(dpi(8), 0, dpi(4), 0)
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        })
        head.contentDescription = "${l.title}, ${if (isOpen) "expanded" else "collapsed"}. Double-tap to ${if (isOpen) "collapse" else "expand"}"
        c.addView(head)
        if (isOpen) {
            val inner = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dpi(16), 0, dpi(16), dpi(14))
            }
            c.addView(inner)
            body(l.body, inner)
            l.tip?.let { callout(it, false, inner) }
            l.warning?.let { callout(it, true, inner) }
            if (i == step.lessons.size - 1) progress.setLessonsRead(step.id)
        }
        head.setOnClickListener {
            if (i in expanded) expanded.remove(i) else expanded.add(i)
            render()
        }
    }

    private fun actionsCard() {
        val c = card()
        actionsCount = small("", c)
        actionsBar = progressBar(c, 0f)
        updateActionsHeader()
        step.tasks.forEach { t ->
            divider(c)
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.TOP
                minimumHeight = dpi(48)
            }
            val cb = CheckBox(this).apply {
                isChecked = progress.isDone(t.id)
                buttonTintList = ColorStateList.valueOf(pal.accent)
                text = t.text
                textSize = 15f
                setTextColor(pal.text)
                setPadding(dpi(8), dpi(6), 0, dpi(6))
                setOnCheckedChangeListener { _, checked ->
                    progress.setDone(t.id, checked)
                    updateActionsHeader()
                    if (checked && progress.stepComplete(step)) celebrate()
                }
            }
            row.addView(cb, LinearLayout.LayoutParams(-1, -2))
            c.addView(row)
            t.detail?.let { small(it, c).setPadding(dpi(40), 0, 0, 0) }
            t.link?.let { link ->
                val holder = LinearLayout(this).apply { setPadding(dpi(36), 0, 0, 0) }
                c.addView(holder)
                linkRow(link, holder)
            }
        }
    }

    private fun updateActionsHeader() {
        val done = progress.tasksDone(step)
        actionsCount?.text = "$done of ${step.tasks.size} done"
        actionsBar?.progress = (done * 1000 / step.tasks.size.coerceAtLeast(1))
    }

    private fun quizCard() {
        val c = card()
        if (progress.quizPassed(step.id)) {
            body("✅ Quiz passed. You've shown you understand this step.", c, pal.good)
            secondaryButton("Take the quiz again", c) { openQuiz() }
        } else {
            body("${step.quiz.size} quick questions to check you've understood the key points. Get them all right to complete the step.", c)
            primaryButton("Start the quiz", c) { openQuiz() }
        }
    }

    private fun buildFooter() {
        val f = footerBar()
        if (index > 0) secondaryButton("← Previous", f, weight = true) { go(index - 1) }
        if (index < Journey.steps.size - 1) primaryButton("Next step →", f, weight = true) { go(index + 1) }
        else primaryButton("Back to home", f, weight = true) { finish() }
    }

    private fun go(i: Int) {
        startActivity(Intent(this, StepActivity::class.java).putExtra("step", Journey.steps[i].id))
        finish()
        overridePendingTransition(0, 0)
    }

    private fun celebrate() {
        val nextIdx = index + 1
        val msg = if (nextIdx < Journey.steps.size) "Step ${index + 1} complete! Next: ${Journey.steps[nextIdx].title}"
        else "Step complete!"
        toast(msg)
    }

    private fun openQuiz() = startActivity(Intent(this, QuizActivity::class.java).putExtra("step", step.id))

    private fun openTool(t: Tool) {
        val i = when (t) {
            Tool.RECORDS -> Intent(this, RecordsActivity::class.java)
            Tool.DEADLINES -> Intent(this, DeadlinesActivity::class.java)
            Tool.TAKE_HOME -> Intent(this, CalculatorsActivity::class.java).putExtra("tab", 0)
            Tool.VAT_CHECK -> Intent(this, CalculatorsActivity::class.java).putExtra("tab", 1)
            Tool.MILEAGE -> Intent(this, MileageActivity::class.java)
        }
        startActivity(i)
    }
}
