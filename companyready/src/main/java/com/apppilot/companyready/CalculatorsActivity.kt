package com.apppilot.companyready

import android.content.Intent
import android.graphics.Typeface
import android.os.Bundle
import android.text.Editable
import android.text.InputType
import android.text.TextWatcher
import android.view.Gravity
import android.view.View
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.Switch
import android.widget.TextView
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter

class CalculatorsActivity : BaseActivity() {
    private var tab = 0
    private lateinit var progress: Progress
    private lateinit var pane: LinearLayout
    private lateinit var results: LinearLayout

    // take-home state
    private var profit = 50_000.0
    private var salaryChoice = 2
    private var customSalary = 12_570.0
    private var divShare = 0
    private var employmentAllowance = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        progress = Progress(this)
        tab = savedInstanceState?.getInt("tab") ?: intent.getIntExtra("tab", 0)
        savedInstanceState?.let {
            profit = it.getDouble("profit", profit); salaryChoice = it.getInt("sal", salaryChoice)
            customSalary = it.getDouble("custom", customSalary); divShare = it.getInt("div", divShare)
            employmentAllowance = it.getBoolean("ea", false)
        }
        setTitles("Calculators", "${Rates.TAX_YEAR} rates · estimates only")
        render()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putInt("tab", tab); outState.putDouble("profit", profit); outState.putInt("sal", salaryChoice)
        outState.putDouble("custom", customSalary); outState.putInt("div", divShare); outState.putBoolean("ea", employmentAllowance)
    }

    private fun render() {
        content.removeAllViews()
        chips(listOf("Take-home pay", "VAT threshold", "VAT & Corporation Tax"), tab, content) { tab = it; render() }
        pane = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        content.addView(pane)
        when (tab) {
            0 -> takeHome()
            1 -> vatThreshold()
            else -> quickCalcs()
        }
    }

    private fun numberInput(hint: String, parent: LinearLayout, value: Double?, onChange: (Double?) -> Unit): EditText {
        val e = input(hint, parent, value?.let { if (it == Math.floor(it)) it.toLong().toString() else it.toString() } ?: "",
            InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL)
        e.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
            override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
            override fun afterTextChanged(s: Editable?) {
                onChange(s?.toString()?.replace(",", "")?.replace("£", "")?.trim()?.toDoubleOrNull())
            }
        })
        return e
    }

    // ---------------- Take-home ----------------

    private val salaryOptions = listOf(
        "£0" to 0.0,
        "£5,000" to Rates.SECONDARY_THRESHOLD,
        "£6,708 (State Pension)" to Rates.LOWER_EARNINGS_LIMIT,
        "£12,570 (personal allowance)" to Rates.PERSONAL_ALLOWANCE,
        "Custom" to -1.0,
    )
    private val divOptions = listOf("All of it" to 1.0, "75%" to 0.75, "50%" to 0.5, "None" to 0.0)

    private fun salary() = salaryOptions[salaryChoice].second.let { if (it < 0) customSalary else it }

    private fun takeHome() {
        val c = card(pane)
        heading("Limited company vs sole trader", c, 17f)
        small("Enter your expected yearly profit before paying yourself (income minus business costs).", c)
        label("Yearly profit (£)", c)
        numberInput("e.g. 50000", c, profit) { profit = it ?: 0.0; showTakeHome() }

        label("Director's salary", c)
        val customBox = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        chips(salaryOptions.map { it.first }, salaryChoice, c) {
            salaryChoice = it
            customBox.visibility = if (it == salaryOptions.size - 1) View.VISIBLE else View.GONE
            showTakeHome()
        }
        c.addView(customBox)
        numberInput("Salary £", customBox, customSalary) { customSalary = it ?: 0.0; showTakeHome() }
        customBox.visibility = if (salaryChoice == salaryOptions.size - 1) View.VISIBLE else View.GONE

        label("How much of the profit left after Corporation Tax to take as dividends", c)
        chips(divOptions.map { it.first }, divShare, c) { divShare = it; showTakeHome() }

        val ea = Switch(this).apply {
            text = "Claim Employment Allowance (only if you have other employees)"
            textSize = 14.5f; setTextColor(pal.text); isChecked = employmentAllowance; minHeight = dpi(48)
            setOnCheckedChangeListener { _, on -> employmentAllowance = on; showTakeHome() }
        }
        c.addView(ea)

        results = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        pane.addView(results)
        showTakeHome()
    }

    private fun showTakeHome() {
        results.removeAllViews()
        val co = Tax.company(profit, salary(), divOptions[divShare].second, employmentAllowance)
        val st = Tax.soleTrader(profit)

        val c = card(results)
        heading("Limited company", c, 16f)
        valueRow("Profit before salary", Money.whole(co.profitBeforeSalary), c)
        valueRow("Salary", Money.whole(co.salary), c)
        valueRow("Employer National Insurance", Money.whole(co.employerNi), c)
        valueRow("Corporation Tax", Money.whole(co.corporationTax), c)
        valueRow("Dividends", Money.whole(co.dividends), c)
        if (co.retained > 0.5) valueRow("Left in the company", Money.whole(co.retained), c)
        divider(c)
        valueRow("Your income tax on salary", Money.whole(co.personal.incomeTaxOnEarnings), c)
        valueRow("Your National Insurance", Money.whole(co.employeeNi), c)
        valueRow("Your dividend tax", Money.whole(co.personal.dividendTax), c)
        divider(c)
        valueRow("Total tax (company + you)", Money.whole(co.totalTax), c)
        valueRow("Your take-home", Money.whole(co.takeHome), c, bold = true, valueColor = pal.good)
        if (co.retained > 0.5) small("Money left in the company isn't taxed on you until you take it out.", c)

        val s = card(results)
        heading("Sole trader", s, 16f)
        valueRow("Profit", Money.whole(st.profit), s)
        valueRow("Income tax", Money.whole(st.personal.incomeTaxOnEarnings), s)
        valueRow("Class 4 National Insurance", Money.whole(st.class4), s)
        divider(s)
        valueRow("Total tax", Money.whole(st.totalTax), s)
        valueRow("Your take-home", Money.whole(st.takeHome), s, bold = true, valueColor = pal.good)

        val cmp = card(results)
        if (divOptions[divShare].second >= 1.0) {
            val diff = co.takeHome - st.takeHome
            heading(when {
                diff > 50 -> "A company could leave you about ${Money.whole(diff)} a year better off"
                diff < -50 -> "Sole trader leaves you about ${Money.whole(-diff)} a year better off"
                else -> "About the same either way"
            }, cmp, 16f)
            small("Before costs: a company usually means £600–£2,400 a year in accountancy and admin. Weigh that, and the protection of limited liability, against the tax difference.", cmp)
        } else {
            heading("Comparing like with like", cmp, 16f)
            small("Choose \"All of it\" for dividends to compare total take-home directly with being a sole trader.", cmp)
        }
        small("Assumes no other income, England/Wales/NI income tax bands, a 12-month accounting period, no student loan and no pension contributions. Scottish income tax bands differ for salary and trading profit.", results)
    }

    // ---------------- VAT threshold ----------------

    private fun vatThreshold() {
        val ledger = Ledger(this)
        val entries = try { ledger.entries() } finally { ledger.close() }
        val today = LocalDate.now()
        val thisMonth = YearMonth.from(today)
        val lastMonth = thisMonth.minusMonths(1)
        val rollingToLastMonth = Books.rolling12(entries, lastMonth) / 100.0
        val rollingToDate = Books.vatTurnover(entries, thisMonth.minusMonths(11).atDay(1), today) / 100.0

        val c = card(pane)
        heading("Your rolling 12-month VAT taxable turnover", c, 17f)
        if (progress.vatRegistered) callout("You're marked as VAT registered. This check is for businesses that aren't registered yet.", false, c)
        val frac = (rollingToDate / Rates.VAT_THRESHOLD).toFloat()
        c.addView(TextView(this).apply {
            text = Money.whole(rollingToDate)
            textSize = 30f; setTypeface(typeface, Typeface.BOLD)
            setTextColor(when { frac >= 1f -> pal.danger; frac >= 0.75f -> pal.warn; else -> pal.text })
        })
        small("12 months to today, from your records · threshold ${Money.whole(Rates.VAT_THRESHOLD)}", c)
        progressBar(c, frac, when { frac >= 1f -> pal.danger; frac >= 0.75f -> pal.warn; else -> pal.accent })
        valueRow("12 months to the end of ${lastMonth.format(DateTimeFormatter.ofPattern("MMMM"))}", Money.whole(rollingToLastMonth), c, bold = true)
        valueRow("Headroom before the threshold", Money.whole(Rates.VAT_THRESHOLD - rollingToLastMonth), c)

        when {
            rollingToLastMonth > Rates.VAT_THRESHOLD -> callout(
                "Your rolling turnover went over ${Money.whole(Rates.VAT_THRESHOLD)} at the end of ${lastMonth.format(DateTimeFormatter.ofPattern("MMMM yyyy"))}. " +
                    "You must register for VAT within 30 days of the end of that month — by ${DeadlineEngine.fmt(lastMonth.atEndOfMonth().plusDays(30))}. Speak to your accountant now.", true, c)
            frac >= 0.9f -> callout("You're within 10% of the threshold. Check at the end of every month and talk to your accountant about registering.", true, c)
            frac >= 0.75f -> callout("You're over 75% of the threshold. Keep a close eye on it each month.", false, c)
            else -> small("Only income marked \"counts towards UK VAT taxable turnover\" is included. App store and overseas ad payouts usually aren't.", c)
        }
        if (entries.none { it.isIncome }) small("Add your income in Records to use this check, or try the manual check below.", c)
        secondaryButton("Open records", c) { startActivity(Intent(this, RecordsActivity::class.java)) }

        val months = Books.monthlyTurnover(entries, thisMonth, 12)
        val maxM = (months.maxOfOrNull { it.second } ?: 0L).coerceAtLeast(1L)
        val mc = card(pane)
        heading("Month by month", mc, 16f)
        for ((ym, pence) in months) {
            val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; setPadding(0, dpi(3), 0, dpi(3)) }
            row.addView(TextView(this).apply { text = ym.format(DateTimeFormatter.ofPattern("MMM yy")); textSize = 13f; setTextColor(pal.subtext) },
                LinearLayout.LayoutParams(dpi(56), -2))
            val track = LinearLayout(this)
            val bar = View(this).apply { background = rounded(pal.accent, dp(4f)) }
            val w = pence.toFloat() / maxM
            track.addView(bar, LinearLayout.LayoutParams(0, dpi(12), w.coerceAtLeast(0.001f)))
            track.addView(View(this), LinearLayout.LayoutParams(0, dpi(12), (1f - w).coerceAtLeast(0.001f)))
            row.addView(track, LinearLayout.LayoutParams(0, -2, 1f))
            row.addView(TextView(this).apply { text = Money.whole(pence / 100.0); textSize = 13f; setTextColor(pal.text); gravity = Gravity.END },
                LinearLayout.LayoutParams(dpi(80), -2))
            row.contentDescription = "${ym.format(DateTimeFormatter.ofPattern("MMMM yyyy"))}: ${Money.whole(pence / 100.0)}"
            mc.addView(row)
        }

        val m = card(pane)
        heading("Manual check", m, 16f)
        label("VAT taxable turnover in the last 12 months (£)", m)
        var past = 0.0; var next30 = 0.0
        val out = small("", m)
        fun update() {
            out.text = Markup.format(when {
                next30 > Rates.VAT_THRESHOLD -> "**Register now.** You expect to go over ${Money.whole(Rates.VAT_THRESHOLD)} in the next 30 days alone, so you must register by the end of that 30-day period."
                past > Rates.VAT_THRESHOLD -> "**You've gone over the threshold.** Register within 30 days of the end of the month you went over."
                past > 0 || next30 > 0 -> "You're under the threshold, with ${Money.whole(Rates.VAT_THRESHOLD - past)} of headroom. Check again at the end of next month."
                else -> "Enter your figures to check."
            })
        }
        numberInput("e.g. 64000", m, null) { past = it ?: 0.0; update() }
        label("Sales you expect in the next 30 days alone (£)", m)
        numberInput("e.g. 5000", m, null) { next30 = it ?: 0.0; update() }
        m.removeView(out); m.addView(out)
        update()
        val links = card(pane, padding = 8)
        linkRow(Link("VAT registration: when to register", "https://www.gov.uk/vat-registration/when-to-register", "GOV.UK"), links)
        linkRow(Link("Calculate VAT taxable turnover", "https://www.gov.uk/vat-registration/calculate-turnover", "GOV.UK"), links)
    }

    // ---------------- Quick calcs ----------------

    private fun quickCalcs() {
        val v = card(pane)
        heading("VAT calculator (20%)", v, 17f)
        label("Amount (£)", v)
        val vOut = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        numberInput("e.g. 120", v, null) { a ->
            vOut.removeAllViews()
            if (a != null && a > 0) {
                valueRow("If £${trim(a)} includes VAT:", "", vOut, bold = true)
                valueRow("  Net", Money.pounds(a - Tax.vatFromGross(a)), vOut)
                valueRow("  VAT", Money.pounds(Tax.vatFromGross(a)), vOut)
                divider(vOut)
                valueRow("If £${trim(a)} is before VAT:", "", vOut, bold = true)
                valueRow("  VAT", Money.pounds(Tax.addVat(a)), vOut)
                valueRow("  Total", Money.pounds(a + Tax.addVat(a)), vOut)
            }
        }
        v.addView(vOut)

        val ct = card(pane)
        heading("Corporation Tax estimate", ct, 17f)
        small("For a 12-month accounting period with no associated companies.", ct)
        label("Taxable profit (£)", ct)
        val ctOut = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        numberInput("e.g. 30000", ct, null) { p ->
            ctOut.removeAllViews()
            if (p != null && p > 0) {
                val tax = Tax.corporationTax(p)
                valueRow("Corporation Tax", Money.pounds(tax), ctOut, bold = true)
                valueRow("Effective rate", String.format(java.util.Locale.UK, "%.2f%%", tax / p * 100), ctOut)
                valueRow("Profit after tax (max dividends)", Money.pounds(p - tax), ctOut)
                small(when {
                    p <= Rates.CT_LOWER_LIMIT -> "Small profits rate: 19%."
                    p >= Rates.CT_UPPER_LIMIT -> "Main rate: 25%."
                    else -> "Between £50,000 and £250,000: main rate with marginal relief."
                }, ctOut)
            }
        }
        ct.addView(ctOut)

        val r = card(pane)
        heading("Key rates for ${Rates.TAX_YEAR}", r, 17f)
        valueRow("Personal allowance", Money.whole(Rates.PERSONAL_ALLOWANCE), r)
        valueRow("Basic rate band (20%)", "to " + Money.whole(Rates.PERSONAL_ALLOWANCE + Rates.BASIC_BAND), r)
        valueRow("Dividend allowance", Money.whole(Rates.DIVIDEND_ALLOWANCE), r)
        valueRow("Dividend tax", "10.75% / 35.75% / 39.35%", r)
        valueRow("Corporation Tax", "19% – 25%", r)
        valueRow("VAT threshold", Money.whole(Rates.VAT_THRESHOLD), r)
        valueRow("Employer NI", "15% over " + Money.whole(Rates.SECONDARY_THRESHOLD), r)
        valueRow("Employee NI", "8% / 2%", r)
        valueRow("Lower Earnings Limit", Money.whole(Rates.LOWER_EARNINGS_LIMIT), r)
        valueRow("Mileage", "45p / 25p a mile", r)
        valueRow("Working from home", "£6 a week", r)
        valueRow("Incorporation fee (online)", Money.whole(Rates.INCORPORATION_FEE), r)
        valueRow("Confirmation statement", Money.whole(Rates.CONFIRMATION_FEE), r)
        linkRow(Link("Income Tax rates and allowances", "https://www.gov.uk/income-tax-rates", "Check for changes"), r)
    }

    private fun trim(a: Double) = if (a == Math.floor(a)) "%,d".format(java.util.Locale.UK, a.toLong()) else String.format(java.util.Locale.UK, "%,.2f", a)
}
