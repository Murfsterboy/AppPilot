package com.apppilot.companyready

import android.app.AlertDialog
import android.app.DatePickerDialog
import android.content.Intent
import android.graphics.Typeface
import android.os.Bundle
import android.provider.CalendarContract
import android.text.InputType
import android.widget.LinearLayout
import android.widget.Switch
import android.widget.TextView
import java.time.LocalDate
import java.time.Month
import java.time.ZoneId
import java.time.format.TextStyle
import java.util.Locale

class DeadlinesActivity : BaseActivity() {
    private lateinit var progress: Progress
    private var editing = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        progress = Progress(this)
        editing = savedInstanceState?.getBoolean("editing") ?: (progress.incorporated == null)
        setTitles("Deadlines", "Companies House, HMRC and your own tax")
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putBoolean("editing", editing)
    }

    override fun onResume() {
        super.onResume()
        render()
    }

    private fun render() {
        val y = scroll.scrollY
        content.removeAllViews()
        if (editing) profileForm() else profileSummary()

        val today = LocalDate.now()
        val list = DeadlineEngine.all(progress.profile(), today)
        sectionHeader("Coming up")
        if (progress.incorporated == null) {
            val c = card()
            body("Add your incorporation date above to see your Companies House and Corporation Tax deadlines. Not registered yet? You'll still see your personal Self Assessment dates below.", c)
        }
        if (list.isEmpty()) {
            body("No deadlines in the next 15 months for the options you've chosen.", color = pal.subtext)
        }
        for (d in list) deadlineCard(d, today)
        small("Dates are worked out from the rules for a typical small private company. If your accounting period has changed, or HMRC or Companies House has given you different dates, use theirs.")
        scroll.post { scroll.scrollTo(0, y) }
    }

    private fun profileSummary() {
        val c = card()
        heading(progress.companyName.ifBlank { "Your company" }, c, 17f)
        val inc = progress.incorporated
        valueRow("Incorporated", inc?.let { DeadlineEngine.fmt(it) } ?: "Not set", c)
        if (inc != null) valueRow("First year end", DeadlineEngine.fmt(DeadlineEngine.firstPeriodEnd(inc, progress.yearEndMonth)), c)
        valueRow("VAT", if (progress.vatRegistered) "Registered (${staggerLabel(progress.vatStagger)})" else "Not registered", c)
        valueRow("Payroll", if (progress.runsPayroll) "Yes" else "No", c)
        valueRow("Self Assessment", if (progress.selfAssessment) "Yes" else "No", c)
        progress.icoPaid?.let { valueRow("ICO fee paid", DeadlineEngine.fmt(it), c) }
        secondaryButton("Edit company details", c) { editing = true; render() }
    }

    private fun staggerLabel(s: Int) = when (s) {
        2 -> "Apr/Jul/Oct/Jan quarters"
        3 -> "May/Aug/Nov/Feb quarters"
        else -> "Mar/Jun/Sep/Dec quarters"
    }

    private fun profileForm() {
        val c = card()
        heading("Your company details", c, 17f)
        small("Used only on this phone to work out your deadlines.", c)

        label("Company name", c)
        val name = input("e.g. Smith Digital Ltd", c, progress.companyName, InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_WORDS)

        label("Date of incorporation (on your certificate)", c)
        var inc = progress.incorporated
        val incBtn = secondaryButton(inc?.let { DeadlineEngine.fmt(it) } ?: "Choose date", c) {}
        incBtn.setOnClickListener {
            val d = inc ?: LocalDate.now()
            DatePickerDialog(this, { _, yy, m, dd -> inc = LocalDate.of(yy, m + 1, dd); incBtn.text = DeadlineEngine.fmt(inc!!) },
                d.year, d.monthValue - 1, d.dayOfMonth).show()
        }

        label("Financial year ends in", c)
        small("Leave as \"Default\" unless you've changed your accounting reference date. By default your first year ends at the end of the month of your first anniversary.", c)
        var yem = progress.yearEndMonth
        val months = listOf("Default") + Month.values().map { it.getDisplayName(TextStyle.SHORT, Locale.UK) }
        chips(months, yem ?: 0, c) { yem = if (it == 0) null else it }

        val vc = card()
        var vatReg = progress.vatRegistered
        var stagger = progress.vatStagger
        val vatSw = Switch(this).apply { text = "VAT registered"; textSize = 15.5f; setTextColor(pal.text); isChecked = vatReg; minHeight = dpi(48) }
        vc.addView(vatSw)
        val staggerBox = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        vc.addView(staggerBox)
        small("Your VAT quarters (on your VAT registration certificate):", staggerBox)
        chips(listOf("Mar/Jun/Sep/Dec", "Apr/Jul/Oct/Jan", "May/Aug/Nov/Feb"), stagger - 1, staggerBox) { stagger = it + 1 }
        staggerBox.visibility = if (vatReg) android.view.View.VISIBLE else android.view.View.GONE
        vatSw.setOnCheckedChangeListener { _, on -> vatReg = on; staggerBox.visibility = if (on) android.view.View.VISIBLE else android.view.View.GONE }

        val payrollSw = Switch(this).apply { text = "Running payroll (paying a salary)"; textSize = 15.5f; setTextColor(pal.text); isChecked = progress.runsPayroll; minHeight = dpi(48) }
        vc.addView(payrollSw)
        val saSw = Switch(this).apply { text = "I file a personal Self Assessment return"; textSize = 15.5f; setTextColor(pal.text); isChecked = progress.selfAssessment; minHeight = dpi(48) }
        vc.addView(saSw)

        label("ICO data protection fee paid on (optional)", vc)
        var ico = progress.icoPaid
        val icoBtn = secondaryButton(ico?.let { DeadlineEngine.fmt(it) } ?: "Choose date", vc) {}
        icoBtn.setOnClickListener {
            val d = ico ?: LocalDate.now()
            DatePickerDialog(this, { _, yy, m, dd -> ico = LocalDate.of(yy, m + 1, dd); icoBtn.text = DeadlineEngine.fmt(ico!!) },
                d.year, d.monthValue - 1, d.dayOfMonth).show()
        }

        primaryButton("Save and show my deadlines") {
            if (inc != null && inc!!.isAfter(LocalDate.now().plusYears(1))) { toast("That incorporation date is too far in the future"); return@primaryButton }
            progress.companyName = name.text.toString().trim()
            progress.incorporated = inc
            progress.yearEndMonth = yem
            progress.vatRegistered = vatReg
            progress.vatStagger = stagger
            progress.runsPayroll = payrollSw.isChecked
            progress.selfAssessment = saSw.isChecked
            progress.icoPaid = ico
            if (inc != null) progress.setDone("register.profile", true)
            editing = false
            render()
            scroll.post { scroll.scrollTo(0, 0) }
        }
    }

    private fun deadlineCard(d: Deadline, today: LocalDate) {
        val days = DeadlineEngine.daysUntil(d.date, today)
        val c = card()
        val color = when {
            days < 0 -> pal.danger
            days <= 30 -> pal.warn
            else -> pal.accent
        }
        c.addView(TextView(this).apply {
            text = (if (days < 0) "WAS DUE " else "") + d.date.format(DeadlineEngine.DISPLAY).uppercase() + " · " + DeadlineEngine.relative(d.date, today)
            textSize = 12.5f; letterSpacing = 0.04f; setTypeface(typeface, Typeface.BOLD); setTextColor(color)
        })
        c.addView(TextView(this).apply {
            text = d.title; textSize = 16.5f; setTypeface(typeface, Typeface.BOLD); setTextColor(pal.text)
            setPadding(0, dpi(4), 0, dpi(2))
        })
        small(d.who, c)
        body(d.detail, c, size = 14.5f)
        val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        c.addView(row)
        secondaryButton("Add to calendar", row, weight = true) { addToCalendar(d) }
        secondaryButton("More info", row, weight = true) { openUrl(d.url) }
    }

    private fun addToCalendar(d: Deadline) {
        val start = d.date.atStartOfDay(ZoneId.of("UTC")).toInstant().toEpochMilli()
        val i = Intent(Intent.ACTION_INSERT)
            .setData(CalendarContract.Events.CONTENT_URI)
            .putExtra(CalendarContract.Events.TITLE, d.title)
            .putExtra(CalendarContract.Events.DESCRIPTION, d.detail + "\n\n" + d.url)
            .putExtra(CalendarContract.EXTRA_EVENT_ALL_DAY, true)
            .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, start)
            .putExtra(CalendarContract.EXTRA_EVENT_END_TIME, start + 24L * 3600 * 1000)
        try { startActivity(i) } catch (e: Exception) {
            AlertDialog.Builder(this).setMessage("No calendar app found. The deadline is ${DeadlineEngine.fmt(d.date)}.")
                .setPositiveButton("OK", null).show()
        }
    }
}
