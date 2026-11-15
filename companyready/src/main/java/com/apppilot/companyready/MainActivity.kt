package com.apppilot.companyready

import android.app.AlertDialog
import android.content.Intent
import android.graphics.Typeface
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import java.time.LocalDate

class MainActivity : BaseActivity() {
    override val showBack = false
    private lateinit var progress: Progress

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        progress = Progress(this)
        if (!progress.acceptedDisclaimer) showDisclaimer()
    }

    override fun onResume() {
        super.onResume()
        render()
    }

    private fun render() {
        val y = scroll.scrollY
        content.removeAllViews()
        val name = progress.companyName
        setTitles("Company Ready UK", if (name.isNotBlank()) name else "Your step-by-step guide to running a UK company")

        hero()
        upcomingDeadline()

        sectionHeader("Your journey")
        Journey.steps.forEachIndexed { i, s -> stepCard(i, s) }

        sectionHeader("Tools")
        val tools = listOf(
            Triple("📒", "Records", "Income, expenses, receipts, director's loan") to { open(RecordsActivity::class.java) },
            Triple("📅", "Deadlines", "Every filing and payment date for your company") to { open(DeadlinesActivity::class.java) },
            Triple("🧮", "Calculators", "Take-home pay, VAT threshold, Corporation Tax") to { open(CalculatorsActivity::class.java) },
            Triple("🚗", "Mileage log", "Business journeys at 45p/25p a mile") to { open(MileageActivity::class.java) },
            Triple("📖", "Glossary", "Plain-English meanings of the jargon") to { open(GlossaryActivity::class.java) },
            Triple("ℹ️", "About & privacy", "Disclaimer, data, rates year") to { open(AboutActivity::class.java) },
        )
        tools.chunked(2).forEach { pair ->
            val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
            content.addView(row, lp())
            pair.forEachIndexed { idx, (t, action) ->
                val c = card(row, 14, onClick = action)
                (c.layoutParams as LinearLayout.LayoutParams).apply {
                    width = 0; weight = 1f
                    if (idx == 0) marginEnd = dpi(6) else marginStart = dpi(6)
                }
                c.contentDescription = "${t.second}. ${t.third}"
                c.addView(TextView(this).apply { text = t.first; textSize = 24f; importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO })
                c.addView(TextView(this).apply {
                    text = t.second; textSize = 16f; setTypeface(typeface, Typeface.BOLD); setTextColor(pal.text)
                    setPadding(0, dpi(6), 0, dpi(2))
                })
                c.addView(TextView(this).apply { text = t.third; textSize = 13f; setTextColor(pal.subtext) })
            }
            if (pair.size == 1) row.addView(View(this), LinearLayout.LayoutParams(0, 1, 1f))
        }

        small("Figures are for the ${Rates.TAX_YEAR} tax year. This app gives general guidance, not personal legal, tax or financial advice.")
        scroll.post { scroll.scrollTo(0, y) }
    }

    private fun hero() {
        val frac = progress.overallFraction()
        val c = card()
        c.background = rounded(pal.accent, dp(18f))
        val pct = (frac * 100).toInt()
        c.addView(TextView(this).apply {
            text = if (pct >= 100) "You're ready to trade 🎉" else "$pct% ready"
            textSize = 24f; setTypeface(typeface, Typeface.BOLD); setTextColor(pal.onAccent)
        })
        val done = Journey.steps.count { progress.stepComplete(it) }
        c.addView(TextView(this).apply {
            text = "$done of ${Journey.steps.size} steps complete"
            textSize = 14f; setTextColor(pal.onAccent); alpha = 0.9f
        })
        progressBar(c, frac, pal.onAccent, pal.onAccent and 0x40FFFFFF)

        val next = progress.nextStep()
        if (next != null) {
            val n = Journey.index(next.id) + 1
            c.addView(TextView(this).apply {
                text = "Up next · Step $n"
                textSize = 13f; setTextColor(pal.onAccent); alpha = 0.85f
                setPadding(0, dpi(10), 0, 0)
            })
            c.addView(TextView(this).apply {
                text = next.title
                textSize = 18f; setTypeface(typeface, Typeface.BOLD); setTextColor(pal.onAccent)
            })
            val b = secondaryButton(if (frac == 0f) "Start step 1" else "Continue", c) { openStep(next.id) }
            b.setTextColor(pal.accent)
            b.background = rounded(pal.onAccent, dp(24f))
        } else {
            c.addView(TextView(this).apply {
                text = "You've completed every step. Keep using Records and Deadlines to stay on top of things."
                textSize = 14.5f; setTextColor(pal.onAccent); setPadding(0, dpi(8), 0, 0)
            })
        }
    }

    private fun upcomingDeadline() {
        if (progress.incorporated == null) return
        val today = LocalDate.now()
        val next = DeadlineEngine.all(progress.profile(), today).firstOrNull { !it.date.isBefore(today) } ?: return
        val c = card(onClick = { open(DeadlinesActivity::class.java) })
        c.addView(TextView(this).apply {
            text = "NEXT DEADLINE · ${DeadlineEngine.relative(next.date, today).uppercase()}"
            textSize = 12f; letterSpacing = 0.06f; setTypeface(typeface, Typeface.BOLD)
            setTextColor(if (DeadlineEngine.daysUntil(next.date, today) <= 30) pal.warn else pal.accent)
        })
        c.addView(TextView(this).apply {
            text = next.title; textSize = 16f; setTypeface(typeface, Typeface.BOLD); setTextColor(pal.text)
            setPadding(0, dpi(4), 0, 0)
        })
        c.addView(TextView(this).apply { text = next.date.format(DeadlineEngine.DISPLAY) + " · " + next.who; textSize = 13.5f; setTextColor(pal.subtext) })
    }

    private fun stepCard(i: Int, s: Step) {
        val frac = progress.stepFraction(s)
        val complete = frac >= 1f
        val c = card(onClick = { openStep(s.id) })
        val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        c.addView(row)
        val badge = TextView(this).apply {
            text = if (complete) "✓" else "${i + 1}"
            textSize = 16f
            gravity = Gravity.CENTER
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(if (complete) pal.onAccent else pal.accent)
            background = rounded(if (complete) pal.accent else pal.surfaceAlt, dp(20f))
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }
        row.addView(badge, LinearLayout.LayoutParams(dpi(40), dpi(40)).apply { marginEnd = dpi(12) })
        val texts = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        texts.addView(TextView(this).apply {
            text = "${s.icon}  ${s.title}"; textSize = 16.5f; setTypeface(typeface, Typeface.BOLD); setTextColor(pal.text)
        })
        val status = when {
            complete -> "Complete"
            frac > 0f -> "${progress.tasksDone(s)} of ${s.tasks.size} done" + if (progress.quizPassed(s.id)) " · quiz passed" else ""
            else -> "${s.minutes} min read · ${s.tasks.size} actions"
        }
        texts.addView(TextView(this).apply { text = status; textSize = 13f; setTextColor(if (complete) pal.good else pal.subtext) })
        row.addView(texts, LinearLayout.LayoutParams(0, -2, 1f))
        body(s.summary, c, pal.subtext, 14f).setPadding(0, dpi(8), 0, 0)
        if (frac > 0f && !complete) progressBar(c, frac)
        c.contentDescription = "Step ${i + 1}: ${s.title}. $status."
    }

    private fun openStep(id: String) = startActivity(Intent(this, StepActivity::class.java).putExtra("step", id))
    private fun open(cls: Class<*>) = startActivity(Intent(this, cls))

    private fun showDisclaimer() {
        AlertDialog.Builder(this)
            .setTitle("Welcome to Company Ready UK")
            .setMessage(
                "This app walks you step by step through becoming self-employed and running a UK limited company — " +
                    "from registering with Companies House to tax, VAT, insurance, expenses and records.\n\n" +
                    "It gives general information for England, Wales, Scotland and Northern Ireland based on ${Rates.TAX_YEAR} rules. " +
                    "It isn't legal, tax or financial advice for your situation. Rules and rates change, so check the official links " +
                    "and speak to a qualified accountant before making decisions.\n\n" +
                    "Your progress and financial records are stored only on this phone."
            )
            .setCancelable(false)
            .setPositiveButton("I understand") { _, _ -> progress.acceptedDisclaimer = true }
            .show()
    }
}
