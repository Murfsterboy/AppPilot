package com.apppilot.companyready

import android.app.AlertDialog
import android.app.DatePickerDialog
import android.graphics.Typeface
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.widget.CheckBox
import android.widget.LinearLayout
import android.widget.TextView
import java.time.LocalDate

class MileageActivity : BaseActivity() {
    private lateinit var ledger: Ledger

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ledger = Ledger(this)
        setTitles("Mileage log", "Business journeys in your own car")
        primaryButton("+ Add journey", footerBar(), weight = true) { editTrip(null) }
    }

    override fun onResume() {
        super.onResume()
        render()
    }

    override fun onDestroy() {
        ledger.close()
        super.onDestroy()
    }

    private fun render() {
        content.removeAllViews()
        val trips = ledger.trips()
        val ty = Books.taxYear(LocalDate.now())
        val inYear = trips.filter { !it.date.isBefore(ty.from) && !it.date.isAfter(ty.to) }
            .sortedBy { it.date }

        // Work out the allowance in date order so the 10,000-mile switch to 25p lands correctly.
        var milesSoFar = 0.0
        var total = 0.0
        var unclaimed = 0.0
        val unclaimedTrips = mutableListOf<Trip>()
        for (t in inYear) {
            val amount = Tax.mileageAllowance(milesSoFar, t.miles)
            milesSoFar += t.miles
            total += amount
            if (!t.claimed) { unclaimed += amount; unclaimedTrips += t }
        }

        val c = card()
        heading(ty.label, c, 16f)
        valueRow("Business miles", String.format(java.util.Locale.UK, "%,.1f", milesSoFar), c)
        valueRow("Tax-free allowance", Money.pounds(total), c, bold = true)
        valueRow("Not yet claimed", Money.pounds(unclaimed), c, valueColor = if (unclaimed > 0) pal.warn else pal.text)
        small("45p a mile for the first 10,000 business miles in the tax year, 25p after that. Commuting to a permanent workplace doesn't count.", c)
        if (unclaimed > 0) {
            primaryButton("Claim ${Money.pounds(unclaimed)} from the company", c) { claim(unclaimedTrips, unclaimed) }
        }

        sectionHeader("Journeys (${trips.size})")
        if (trips.isEmpty()) {
            val e = card()
            body("No journeys yet.", e)
            small("Log each business journey: date, where from and to, why, and the miles. Trips to clients, conferences, the post office or a temporary workplace all count.", e)
        }
        val list = if (trips.isNotEmpty()) card(padding = 4) else null
        for (t in trips) {
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(dpi(12), dpi(10), dpi(12), dpi(10))
                minimumHeight = dpi(56)
                isClickable = true; isFocusable = true
                setOnClickListener { editTrip(t) }
            }
            val texts = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
            texts.addView(TextView(this).apply {
                text = "${t.from} → ${t.to}"; textSize = 15f; setTypeface(typeface, Typeface.BOLD); setTextColor(pal.text)
            })
            texts.addView(TextView(this).apply {
                text = "${DeadlineEngine.fmt(t.date)} · ${t.purpose}" + if (t.claimed) " · claimed" else ""
                textSize = 12.5f; setTextColor(pal.subtext)
            })
            row.addView(texts, LinearLayout.LayoutParams(0, -2, 1f))
            row.addView(TextView(this).apply {
                text = String.format(java.util.Locale.UK, "%.1f mi", t.miles); textSize = 15f; setTextColor(pal.text)
            })
            list?.addView(row)
        }
        if (trips.isNotEmpty()) secondaryButton("Share mileage log (CSV)") {
            val send = android.content.Intent(android.content.Intent.ACTION_SEND).setType("text/plain")
                .putExtra(android.content.Intent.EXTRA_TEXT, Books.tripsCsv(trips))
                .putExtra(android.content.Intent.EXTRA_SUBJECT, "Mileage log")
            safeStart(android.content.Intent.createChooser(send, "Share mileage log"))
        }
    }

    private fun claim(trips: List<Trip>, amount: Double) {
        AlertDialog.Builder(this)
            .setTitle("Claim mileage")
            .setMessage("This adds a ${Money.pounds(amount)} \"Mileage paid to me\" expense to your records (the company owes you this, tax-free) and marks these ${trips.size} journeys as claimed.\n\nThen pay yourself from the company account and record it as \"Repaid to me (director loan)\".")
            .setPositiveButton("Add claim") { _, _ ->
                ledger.save(Entry(
                    date = LocalDate.now(), isIncome = false, category = "ex.mileage",
                    description = "Mileage claim: ${trips.size} journeys, " + String.format(java.util.Locale.UK, "%.1f", trips.sumOf { it.miles }) + " miles",
                    party = "", amount = Math.round(amount * 100), vat = 0, paidPersonally = true,
                    countsForVat = false, receiptUri = null, notes = "From the mileage log",
                ))
                trips.forEach { ledger.save(it.copy(claimed = true)) }
                toast("Claim added to your records")
                render()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun editTrip(t: Trip?) {
        var date = t?.date ?: LocalDate.now()
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dpi(20), dpi(8), dpi(20), 0)
        }
        val dateBtn = secondaryButton(DeadlineEngine.fmt(date), box) {}
        dateBtn.setOnClickListener {
            DatePickerDialog(this, { _, y, m, d -> date = LocalDate.of(y, m + 1, d); dateBtn.text = DeadlineEngine.fmt(date) },
                date.year, date.monthValue - 1, date.dayOfMonth).show()
        }
        val from = input("From (e.g. Home, Leeds)", box, t?.from ?: "", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_WORDS)
        val to = input("To (e.g. Client office, Manchester)", box, t?.to ?: "", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_WORDS)
        val purpose = input("Purpose (e.g. Client meeting)", box, t?.purpose ?: "", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES)
        val miles = input("Miles one way", box, t?.let { String.format(java.util.Locale.UK, "%.1f", it.miles) } ?: "",
            InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL)
        val ret = CheckBox(this).apply {
            text = "Return journey (double the miles)"; setTextColor(pal.text); isChecked = t == null
            visibility = if (t == null) android.view.View.VISIBLE else android.view.View.GONE
        }
        box.addView(ret)
        val sv = android.widget.ScrollView(this).apply { addView(box) }
        val b = AlertDialog.Builder(this)
            .setTitle(if (t == null) "Add journey" else "Edit journey")
            .setView(sv)
            .setPositiveButton("Save", null)
            .setNegativeButton("Cancel", null)
        if (t != null) b.setNeutralButton("Delete") { _, _ -> ledger.deleteTrip(t.id); render() }
        val dlg = b.create()
        dlg.setOnShowListener {
            dlg.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val m = miles.text.toString().replace(",", "").toDoubleOrNull()
                when {
                    from.text.isBlank() -> from.error = "Where did you start?"
                    to.text.isBlank() -> to.error = "Where did you go?"
                    m == null || m <= 0 -> miles.error = "Enter the miles"
                    else -> {
                        val total = if (ret.isChecked && t == null) m * 2 else m
                        ledger.save(Trip(t?.id ?: 0, date, from.text.toString().trim(), to.text.toString().trim(),
                            purpose.text.toString().trim().ifEmpty { "Business journey" }, Math.round(total * 10), t?.claimed ?: false))
                        dlg.dismiss()
                        render()
                    }
                }
            }
        }
        dlg.show()
    }
}
