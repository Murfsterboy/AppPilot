package com.apppilot.companyready

import android.app.AlertDialog
import android.app.DatePickerDialog
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.text.InputType
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.Switch
import java.time.LocalDate

class EntryActivity : BaseActivity() {
    private lateinit var ledger: Ledger
    private lateinit var progress: Progress
    private var existing: Entry? = null

    private var isIncome = false
    private var date: LocalDate = LocalDate.now()
    private var category: Category = Categories.expense.first()
    private var receipt: String? = null

    private lateinit var amount: EditText
    private lateinit var vat: EditText
    private lateinit var desc: EditText
    private lateinit var party: EditText
    private lateinit var notes: EditText
    private var personal: Switch? = null
    private var vatTurnover: Switch? = null
    private lateinit var form: LinearLayout

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ledger = Ledger(this)
        progress = Progress(this)
        val id = intent.getLongExtra("id", 0L)
        existing = if (id != 0L) ledger.entry(id) else null
        existing?.let {
            isIncome = it.isIncome; date = it.date; category = it.cat; receipt = it.receiptUri
        } ?: run {
            isIncome = intent.getBooleanExtra("income", false)
            category = if (isIncome) Categories.income.first() else Categories.expense.first()
        }
        savedInstanceState?.let { s ->
            isIncome = s.getBoolean("income", isIncome)
            date = LocalDate.ofEpochDay(s.getLong("date", date.toEpochDay()))
            category = Categories.byKey(s.getString("cat") ?: category.key)
            receipt = s.getString("receipt", receipt)
        }
        setTitles(if (existing == null) (if (isIncome) "Add money in" else "Add money out") else "Edit entry")

        form = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        content.addView(form)
        buildForm()

        val f = footerBar()
        if (existing != null) secondaryButton("Delete", f, weight = true) { confirmDelete() }
        primaryButton("Save", f, weight = true) { save() }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putBoolean("income", isIncome)
        outState.putLong("date", date.toEpochDay())
        outState.putString("cat", category.key)
        outState.putString("receipt", receipt)
    }

    override fun onDestroy() {
        ledger.close()
        super.onDestroy()
    }

    private fun buildForm() {
        val e = existing
        val c = card(form)

        label("Date", c)
        val dateBtn = secondaryButton(DeadlineEngine.fmt(date), c) {}
        dateBtn.setOnClickListener {
            DatePickerDialog(this, { _, y, m, d ->
                date = LocalDate.of(y, m + 1, d); dateBtn.text = DeadlineEngine.fmt(date)
            }, date.year, date.monthValue - 1, date.dayOfMonth).show()
        }
        dateBtn.contentDescription = "Date: ${DeadlineEngine.fmt(date)}. Double-tap to change"

        label(if (isIncome) "Amount received (£)" else "Amount paid (£, including any VAT)", c)
        amount = input("0.00", c, e?.let { "%.2f".format(java.util.Locale.UK, it.amount / 100.0) } ?: "",
            InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL)

        label("Category", c)
        val catBtn = secondaryButton(category.name, c) {}
        val catHint = small(category.hint, c)
        catBtn.setOnClickListener {
            val list = if (isIncome) Categories.income else Categories.expense
            AlertDialog.Builder(this)
                .setTitle("Category")
                .setItems(list.map { it.name }.toTypedArray()) { _, which ->
                    category = list[which]
                    catBtn.text = category.name
                    catHint.text = Markup.format(category.hint)
                    vatTurnover?.isChecked = category.vatTurnoverDefault
                }.show()
        }

        label("Description", c)
        desc = input(if (isIncome) "e.g. Google Play payout for March" else "e.g. MacBook Air for app development", c, e?.description ?: "",
            InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES)

        label(if (isIncome) "From (customer or platform)" else "Supplier", c)
        party = input(if (isIncome) "e.g. Google" else "e.g. Apple Store", c, e?.party ?: "",
            InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_WORDS)

        val vc = card(form)
        heading("VAT", vc, 16f)
        small(if (progress.vatRegistered) "Enter the VAT included in the amount (shown on the invoice or receipt)."
              else "You're not VAT registered (change this in Deadlines). You can still note VAT shown on receipts; it's included in your costs.", vc)
        val vatRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        vc.addView(vatRow)
        vat = EditText(this).apply {
            hint = "VAT £0.00"
            setText(e?.let { if (it.vat > 0) "%.2f".format(java.util.Locale.UK, it.vat / 100.0) else "" } ?: "")
            inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL
            textSize = 16f; setTextColor(pal.text); setHintTextColor(pal.subtext)
            background = rounded(pal.surfaceAlt, dp(10f))
            setPadding(dpi(12), dpi(12), dpi(12), dpi(12))
        }
        vatRow.addView(vat, LinearLayout.LayoutParams(0, -2, 1f).apply { marginEnd = dpi(8) })
        secondaryButton("20% of total", vatRow, weight = true) {
            val gross = Money.parsePence(amount.text.toString())
            if (gross == null) toast("Enter the amount first")
            else vat.setText("%.2f".format(java.util.Locale.UK, Math.round(gross / 6.0) / 100.0))
        }

        if (isIncome) {
            vatTurnover = switchRow(vc, "Counts towards UK VAT taxable turnover",
                "Used by the VAT threshold checker. App store and overseas ad payouts usually don't count.",
                e?.countsForVat ?: category.vatTurnoverDefault)
        } else {
            val pc = card(form)
            personal = switchRow(pc, "I paid this personally",
                "Turn on if you paid with your own money or card. The company then owes you this amount (director's loan).",
                e?.paidPersonally ?: false)
        }

        val rc = card(form)
        heading("Receipt or invoice", rc, 16f)
        val rStatus = small(if (receipt != null) "📎 Receipt attached" else "Attach a photo or PDF of the receipt so you have evidence for HMRC.", rc)
        val rRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        rc.addView(rRow)
        secondaryButton(if (receipt != null) "Replace" else "Attach", rRow, weight = true) { pickReceipt() }
        if (receipt != null) {
            secondaryButton("View", rRow, weight = true) {
                safeStart(Intent(Intent.ACTION_VIEW).setDataAndType(Uri.parse(receipt), null)
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION), "Couldn't open the receipt. It may have been moved or deleted.")
            }
            secondaryButton("Remove", rRow, weight = true) { receipt = null; rebuild() }
        }
        rStatus.contentDescription = rStatus.text

        val nc = card(form)
        label("Notes (optional)", nc)
        notes = input("e.g. invoice number, what it was for", nc, e?.notes ?: "",
            InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES)
    }

    private fun rebuild() {
        val a = amount.text.toString(); val v = vat.text.toString(); val d = desc.text.toString()
        val p = party.text.toString(); val n = notes.text.toString()
        val pers = personal?.isChecked; val vt = vatTurnover?.isChecked
        form.removeAllViews()
        buildForm()
        amount.setText(a); vat.setText(v); desc.setText(d); party.setText(p); notes.setText(n)
        pers?.let { personal?.isChecked = it }; vt?.let { vatTurnover?.isChecked = it }
    }

    private fun switchRow(parent: LinearLayout, title: String, sub: String, on: Boolean): Switch {
        val sw = Switch(this).apply {
            text = title
            textSize = 15.5f
            setTextColor(pal.text)
            isChecked = on
            minHeight = dpi(48)
        }
        parent.addView(sw, lp())
        small(sub, parent)
        return sw
    }

    private fun pickReceipt() {
        val i = Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
            .setType("*/*").putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("image/*", "application/pdf"))
        try {
            @Suppress("DEPRECATION")
            startActivityForResult(i, REQ_RECEIPT)
        } catch (e: Exception) { toast("No file picker available") }
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQ_RECEIPT && resultCode == RESULT_OK) {
            val uri = data?.data ?: return
            try {
                contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            } catch (e: SecurityException) { /* still usable this session */ }
            receipt = uri.toString()
            rebuild()
        }
    }

    private fun save() {
        val gross = Money.parsePence(amount.text.toString())
        if (gross == null || gross <= 0) { amount.error = "Enter an amount, e.g. 49.99"; amount.requestFocus(); return }
        val vatP = Money.parsePence(vat.text.toString()) ?: 0L
        if (vatP < 0 || vatP > gross) { vat.error = "VAT can't be more than the amount"; vat.requestFocus(); return }
        val entry = Entry(
            id = existing?.id ?: 0L,
            date = date,
            isIncome = isIncome,
            category = category.key,
            description = desc.text.toString().trim().ifEmpty { category.name },
            party = party.text.toString().trim(),
            amount = gross,
            vat = vatP,
            paidPersonally = personal?.isChecked ?: false,
            countsForVat = vatTurnover?.isChecked ?: false,
            receiptUri = receipt,
            notes = notes.text.toString().trim(),
        )
        ledger.save(entry)
        toast("Saved")
        finish()
    }

    private fun confirmDelete() {
        val e = existing ?: return
        AlertDialog.Builder(this)
            .setMessage("Delete this entry? This can't be undone.")
            .setPositiveButton("Delete") { _, _ -> ledger.delete(e.id); finish() }
            .setNegativeButton("Cancel", null)
            .show()
    }

    companion object { const val REQ_RECEIPT = 42 }
}
