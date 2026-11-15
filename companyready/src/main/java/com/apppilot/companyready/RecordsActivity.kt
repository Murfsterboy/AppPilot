package com.apppilot.companyready

import android.app.AlertDialog
import android.content.Intent
import android.graphics.Typeface
import android.os.Bundle
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.TextView
import java.time.LocalDate
import java.time.format.DateTimeFormatter

class RecordsActivity : BaseActivity() {
    private lateinit var ledger: Ledger
    private lateinit var progress: Progress
    private var period = 0
    private var pendingCsv: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ledger = Ledger(this)
        progress = Progress(this)
        period = savedInstanceState?.getInt("period") ?: 0
        setTitles("Financial records", "Income, expenses and receipts")
        val f = footerBar()
        primaryButton("+ Money in", f, weight = true) { add(true) }
        primaryButton("− Money out", f, weight = true) { add(false) }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putInt("period", period)
    }

    override fun onResume() {
        super.onResume()
        render()
    }

    override fun onDestroy() {
        ledger.close()
        super.onDestroy()
    }

    private fun currentPeriod(): Books.Period {
        val today = LocalDate.now()
        return when (period) {
            0 -> Books.companyYear(today, progress.yearEndMonth, progress.incorporated)
            1 -> Books.taxYear(today)
            2 -> Books.Period("Last 12 months", today.minusMonths(12).plusDays(1), today)
            else -> Books.Period("All time", null, null)
        }
    }

    private fun render() {
        val y = scroll.scrollY
        content.removeAllViews()
        val all = ledger.entries()
        val p = currentPeriod()
        val entries = ledger.entries(p.from, p.to)
        val vatReg = progress.vatRegistered
        val s = Books.summarise(entries, vatReg)

        chips(listOf("Company year", "Tax year", "Last 12 months", "All time"), period, content) { period = it; render() }

        val c = card()
        heading(p.label, c, 16f)
        if (vatReg) small("Amounts shown excluding VAT (you're VAT registered).", c)
        valueRow("Money in (income)", Money.pence(s.income), c, valueColor = pal.good)
        valueRow("Allowable expenses", Money.pence(s.allowable), c)
        valueRow("Equipment (capital allowances)", Money.pence(s.capital), c)
        divider(c)
        valueRow("Estimated profit", Money.pence(s.profit), c, bold = true)
        valueRow("Estimated Corporation Tax", Money.pence(s.estimatedCorporationTax), c)
        valueRow("Estimated profit after tax", Money.pence(s.profitAfterTax), c, bold = true)
        divider(c)
        valueRow("Dividends paid", Money.pence(s.dividends), c)
        if (s.notAllowable > 0) valueRow("Not tax-deductible spending", Money.pence(s.notAllowable), c)
        if (vatReg) {
            valueRow("VAT on sales", Money.pence(s.vatOnSales), c)
            valueRow("VAT on purchases (reclaimable)", Money.pence(s.vatOnPurchases), c)
            valueRow("Estimated VAT to pay", Money.pence(s.vatOnSales - s.vatOnPurchases), c, bold = true)
        }
        if (s.dividends > s.profitAfterTax && s.dividends > 0 && period != 3)
            callout("Dividends this period are more than the estimated profit after tax. Dividends must come from profits (including profits kept from earlier years) — check with your accountant.", true, c)
        small("Estimates assume a 12-month period and include equipment at 100% (Annual Investment Allowance). Your accountant's figures are final.", c)

        val loan = Books.directorLoanBalance(all)
        val lc = card()
        heading("Director's loan account", lc, 16f)
        when {
            loan > 0 -> body("The company owes you **${Money.pence(loan)}**. You can repay yourself tax-free — record it as \"Repaid to me (director loan)\".", lc)
            loan < 0 -> {
                body("You owe the company **${Money.pence(-loan)}**.", lc)
                callout("If this is still owed 9 months after the company's year end, the company pays a temporary s455 tax charge. Loans over £10,000 can also be a taxable benefit.", true, lc)
            }
            else -> body("Balanced: neither you nor the company owes the other anything.", lc)
        }
        small("Built from money you've put in, business costs you paid personally, and repayments to you.", lc)

        val tools = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        content.addView(tools, lp(bottom = 8))
        secondaryButton("Export CSV", tools, weight = true) { export(entries, p) }
        secondaryButton("VAT threshold", tools, weight = true) {
            startActivity(Intent(this, CalculatorsActivity::class.java).putExtra("tab", 1))
        }

        sectionHeader("Entries (${entries.size})")
        if (entries.isEmpty()) {
            val e = card()
            body("No entries yet for this period.", e)
            small("Tap **+ Money in** for income such as app store payouts, or **− Money out** for anything the company spends. Add things you paid for personally too — the app works out what the company owes you.", e)
        }
        var month = ""
        val monthFmt = DateTimeFormatter.ofPattern("MMMM yyyy")
        var group: LinearLayout? = null
        for (e in entries) {
            val m = e.date.format(monthFmt)
            if (m != month || group == null) {
                month = m
                small(m, content).setPadding(dpi(4), dpi(8), 0, dpi(4))
                group = card(padding = 4)
            }
            entryRow(e, group)
        }
        scroll.post { scroll.scrollTo(0, y) }
    }

    private fun entryRow(e: Entry, parent: LinearLayout) {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dpi(12), dpi(10), dpi(12), dpi(10))
            minimumHeight = dpi(56)
            isClickable = true; isFocusable = true
            setOnClickListener { startActivity(Intent(this@RecordsActivity, EntryActivity::class.java).putExtra("id", e.id)) }
        }
        val texts = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        texts.addView(TextView(this).apply {
            text = e.description.ifBlank { e.cat.name }
            textSize = 15f; setTextColor(pal.text); setTypeface(typeface, Typeface.BOLD)
            maxLines = 2
        })
        val tags = buildList {
            add(e.date.format(DateTimeFormatter.ofPattern("d MMM")))
            add(e.cat.name)
            if (e.paidPersonally) add("paid personally")
            if (e.receiptUri != null) add("📎")
        }
        texts.addView(TextView(this).apply { text = tags.joinToString(" · "); textSize = 12.5f; setTextColor(pal.subtext) })
        row.addView(texts, LinearLayout.LayoutParams(0, -2, 1f))
        val sign = if (e.isIncome) "+" else "−"
        row.addView(TextView(this).apply {
            text = sign + Money.pence(e.amount)
            textSize = 15f; setTypeface(typeface, Typeface.BOLD)
            setTextColor(if (e.isIncome) pal.good else pal.text)
            setPadding(dpi(8), 0, 0, 0)
        })
        row.contentDescription = "${if (e.isIncome) "Money in" else "Money out"} ${Money.pence(e.amount)}, ${e.description}, ${e.cat.name}, ${e.date}"
        parent.addView(row)
    }

    private fun add(income: Boolean) =
        startActivity(Intent(this, EntryActivity::class.java).putExtra("income", income))

    private fun export(entries: List<Entry>, p: Books.Period) {
        if (entries.isEmpty()) { toast("Nothing to export for this period"); return }
        pendingCsv = Books.csv(entries)
        val name = "company-records-" + p.label.lowercase().replace(Regex("[^a-z0-9]+"), "-").trim('-') + ".csv"
        val i = Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
            .setType("text/csv").putExtra(Intent.EXTRA_TITLE, name)
        try {
            @Suppress("DEPRECATION")
            startActivityForResult(i, REQ_EXPORT)
        } catch (e: Exception) {
            shareCsv(pendingCsv!!)
        }
    }

    private fun shareCsv(csv: String) {
        val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, csv)
            .putExtra(Intent.EXTRA_SUBJECT, "Company records")
        safeStart(Intent.createChooser(send, "Share records"))
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQ_EXPORT && resultCode == RESULT_OK) {
            val uri = data?.data ?: return
            val csv = pendingCsv ?: return
            try {
                contentResolver.openOutputStream(uri)?.use { it.write(csv.toByteArray(Charsets.UTF_8)) }
                toast("Exported")
            } catch (e: Exception) {
                AlertDialog.Builder(this).setMessage("Couldn't save the file: ${e.message}").setPositiveButton("OK", null).show()
            }
        }
    }

    companion object { const val REQ_EXPORT = 41 }
}
