package com.apppilot.companyready

import java.time.LocalDate
import java.time.YearMonth
import java.time.temporal.TemporalAdjusters

/** Totals worked out from the ledger. All amounts in pence. */
data class Summary(
    val income: Long,
    val allowable: Long,
    val capital: Long,
    val notAllowable: Long,
    val dividends: Long,
    val taxPaid: Long,
    val vatOnSales: Long,
    val vatOnPurchases: Long,
    val count: Int,
) {
    val profit get() = income - allowable - capital
    val estimatedCorporationTax get() = Math.round(Tax.corporationTax(profit / 100.0) * 100)
    val profitAfterTax get() = profit - estimatedCorporationTax
}

object Books {

    /** Income/expense value used for profit: net of VAT only when you can reclaim/account for it. */
    private fun value(e: Entry, vatRegistered: Boolean) = if (vatRegistered) e.amount - e.vat else e.amount

    fun summarise(entries: List<Entry>, vatRegistered: Boolean): Summary {
        var income = 0L; var allowable = 0L; var capital = 0L; var notAllowable = 0L
        var dividends = 0L; var taxPaid = 0L; var vatSales = 0L; var vatPurchases = 0L
        for (e in entries) {
            when (e.cat.role) {
                Role.INCOME -> { income += value(e, vatRegistered); vatSales += e.vat }
                Role.EXPENSE -> { allowable += value(e, vatRegistered); vatPurchases += e.vat }
                Role.CAPITAL -> { capital += value(e, vatRegistered); vatPurchases += e.vat }
                Role.NOT_ALLOWABLE -> notAllowable += e.amount
                Role.DIVIDEND -> dividends += e.amount
                Role.TAX_PAID -> taxPaid += e.amount
                Role.LOAN_IN, Role.LOAN_OUT -> {}
            }
        }
        return Summary(income, allowable, capital, notAllowable, dividends, taxPaid,
            if (vatRegistered) vatSales else 0, if (vatRegistered) vatPurchases else 0, entries.size)
    }

    /**
     * What the company owes you (positive) or you owe the company (negative), across all time:
     * money you lent + business costs you paid personally − repayments to you.
     */
    fun directorLoanBalance(entries: List<Entry>): Long {
        var bal = 0L
        for (e in entries) {
            when (e.cat.role) {
                Role.LOAN_IN -> bal += e.amount
                Role.LOAN_OUT -> bal -= e.amount
                Role.INCOME -> {}
                else -> if (e.paidPersonally) bal += e.amount
            }
        }
        return bal
    }

    /** VAT taxable turnover (excluding VAT itself) for income entries in [from]..[to]. */
    fun vatTurnover(entries: List<Entry>, from: LocalDate, to: LocalDate): Long =
        entries.filter { it.isIncome && it.cat.role == Role.INCOME && it.countsForVat && !it.date.isBefore(from) && !it.date.isAfter(to) }
            .sumOf { it.amount - it.vat }

    /** Rolling 12-month turnover for each of the last [months] months (oldest first), by month end. */
    fun monthlyTurnover(entries: List<Entry>, endMonth: YearMonth, months: Int = 12): List<Pair<YearMonth, Long>> =
        (months - 1 downTo 0).map { back ->
            val ym = endMonth.minusMonths(back.toLong())
            ym to vatTurnover(entries, ym.atDay(1), ym.atEndOfMonth())
        }

    fun rolling12(entries: List<Entry>, endMonth: YearMonth): Long =
        vatTurnover(entries, endMonth.minusMonths(11).atDay(1), endMonth.atEndOfMonth())

    // ----- periods -----

    data class Period(val label: String, val from: LocalDate?, val to: LocalDate?)

    fun taxYear(today: LocalDate): Period {
        val startYear = if (today.isBefore(LocalDate.of(today.year, 4, 6))) today.year - 1 else today.year
        return Period("Tax year ${startYear}/${(startYear + 1) % 100}", LocalDate.of(startYear, 4, 6), LocalDate.of(startYear + 1, 4, 5))
    }

    /** The company's current financial year, from its year-end month (defaults to March if unknown). */
    fun companyYear(today: LocalDate, yearEndMonth: Int?, incorporated: LocalDate?): Period {
        if (incorporated != null) {
            for (p in DeadlineEngine.companyPeriods(incorporated, yearEndMonth, 30)) {
                if (!today.isAfter(p.end)) {
                    val from = maxOf(p.start, incorporated)
                    return Period("Company year to ${DeadlineEngine.fmt(p.end)}", from, p.end)
                }
            }
        }
        val m = yearEndMonth ?: 3
        var end = LocalDate.of(today.year, m, 1).with(TemporalAdjusters.lastDayOfMonth())
        if (end.isBefore(today)) end = end.plusYears(1).with(TemporalAdjusters.lastDayOfMonth())
        val start = end.minusYears(1).with(TemporalAdjusters.lastDayOfMonth()).plusDays(1)
        return Period("Company year to ${DeadlineEngine.fmt(end)}", start, end)
    }

    fun csv(entries: List<Entry>): String {
        val sb = StringBuilder()
        sb.append("Date,Type,Category,Description,Customer/Supplier,Gross,VAT,Net,Paid personally,Counts for VAT turnover,Receipt attached,Notes\n")
        for (e in entries.sortedBy { it.date }) {
            sb.append(listOf(
                e.date.toString(),
                if (e.isIncome) "Money in" else "Money out",
                e.cat.name, e.description, e.party,
                String.format(java.util.Locale.UK, "%.2f", e.amount / 100.0), String.format(java.util.Locale.UK, "%.2f", e.vat / 100.0), String.format(java.util.Locale.UK, "%.2f", (e.amount - e.vat) / 100.0),
                if (e.paidPersonally) "Yes" else "No",
                if (e.isIncome) (if (e.countsForVat) "Yes" else "No") else "",
                if (e.receiptUri != null) "Yes" else "No",
                e.notes,
            ).joinToString(",") { cell(it) }).append('\n')
        }
        return sb.toString()
    }

    fun tripsCsv(trips: List<Trip>): String {
        val sb = StringBuilder("Date,From,To,Purpose,Miles,Claimed\n")
        for (t in trips.sortedBy { it.date }) {
            sb.append(listOf(t.date.toString(), t.from, t.to, t.purpose, String.format(java.util.Locale.UK, "%.1f", t.miles), if (t.claimed) "Yes" else "No")
                .joinToString(",") { cell(it) }).append('\n')
        }
        return sb.toString()
    }

    private fun cell(s: String): String {
        // Quote fields and neutralise spreadsheet formula injection.
        val safe = if (s.isNotEmpty() && s[0] in "=+-@") "'$s" else s
        return "\"" + safe.replace("\"", "\"\"") + "\""
    }
}
