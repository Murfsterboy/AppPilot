package com.apppilot.companyready

import java.time.LocalDate
import java.time.Month
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.time.temporal.TemporalAdjusters

/** What the deadline engine needs to know about your company. */
data class CompanyProfile(
    val incorporated: LocalDate?,
    /** Month (1–12) your company's financial year ends in (the accounting reference date is the last day of it). */
    val yearEndMonth: Int?,
    val vatRegistered: Boolean = false,
    /** 1 = quarters ending Mar/Jun/Sep/Dec, 2 = Apr/Jul/Oct/Jan, 3 = May/Aug/Nov/Feb. */
    val vatStagger: Int = 1,
    val runsPayroll: Boolean = false,
    val selfAssessment: Boolean = true,
    val icoPaid: LocalDate? = null,
)

data class Deadline(
    val date: LocalDate,
    val title: String,
    val detail: String,
    val who: String,
    val url: String,
)

object DeadlineEngine {
    val DISPLAY: DateTimeFormatter = DateTimeFormatter.ofPattern("EEE d MMM yyyy")

    /** Adds months the way Companies House does: a month-end date moves to the target month's end. */
    fun addMonthsCH(d: LocalDate, months: Long): LocalDate {
        val moved = d.plusMonths(months)
        return if (d.dayOfMonth == d.lengthOfMonth()) moved.with(TemporalAdjusters.lastDayOfMonth()) else moved
    }

    /**
     * The first accounting reference date (end of the first financial period). By default it's the
     * last day of the month in which the first anniversary of incorporation falls. A different year-end
     * month gives the first such month-end that is more than 6 months after incorporation
     * (a first period must be over 6 and no more than 18 months).
     */
    fun firstPeriodEnd(incorporated: LocalDate, yearEndMonth: Int?): LocalDate {
        val month = yearEndMonth ?: incorporated.monthValue
        var candidate = LocalDate.of(incorporated.year, month, 1).with(TemporalAdjusters.lastDayOfMonth())
        while (!candidate.isAfter(incorporated.plusMonths(6))) {
            candidate = candidate.plusYears(1).with(TemporalAdjusters.lastDayOfMonth())
        }
        return candidate
    }

    data class Period(val start: LocalDate, val end: LocalDate, val first: Boolean)

    fun companyPeriods(incorporated: LocalDate, yearEndMonth: Int?, count: Int): List<Period> {
        val out = mutableListOf<Period>()
        var start = incorporated
        var end = firstPeriodEnd(incorporated, yearEndMonth)
        repeat(count) { i ->
            out += Period(start, end, i == 0)
            start = end.plusDays(1)
            end = end.plusYears(1).with(TemporalAdjusters.lastDayOfMonth())
        }
        return out
    }

    fun accountsDue(p: Period, incorporated: LocalDate): LocalDate {
        val longFirst = p.first && p.end.isAfter(incorporated.plusMonths(12).minusDays(1))
        return if (longFirst) maxOf(addMonthsCH(incorporated, 21), addMonthsCH(p.end, 3))
        else addMonthsCH(p.end, 9)
    }

    /** Corporation Tax periods can't be longer than 12 months, so a long first period splits in two. */
    fun ctPeriods(p: Period): List<Pair<LocalDate, LocalDate>> {
        val out = mutableListOf<Pair<LocalDate, LocalDate>>()
        var s = p.start
        while (!s.isAfter(p.end)) {
            val e = minOf(s.plusMonths(12).minusDays(1), p.end)
            out += s to e
            s = e.plusDays(1)
        }
        return out
    }

    fun all(profile: CompanyProfile, today: LocalDate = LocalDate.now()): List<Deadline> {
        val out = mutableListOf<Deadline>()
        val from = today.minusDays(45)
        val to = today.plusMonths(15)
        val inc = profile.incorporated

        if (inc != null) {
            out += Deadline(
                inc.plusMonths(3),
                "Check you're set up for Corporation Tax",
                "Online registration usually sets this up automatically (look for HMRC's letter with your UTR). If not, register " +
                    "within 3 months of starting to do business. Shown as 3 months after incorporation.",
                "HMRC", "https://www.gov.uk/limited-company-formation/set-up-your-company-for-corporation-tax",
            )
            for (p in companyPeriods(inc, profile.yearEndMonth, 5)) {
                out += Deadline(
                    accountsDue(p, inc),
                    "File annual accounts with Companies House",
                    "For the period ${fmt(p.start)} to ${fmt(p.end)}." +
                        (if (p.first) " Your first accounts get longer (21 months from incorporation)." else "") +
                        " Late filing penalties start at £150 for a private company.",
                    "Companies House", "https://www.gov.uk/file-your-company-annual-accounts",
                )
                for ((s, e) in ctPeriods(p)) {
                    out += Deadline(
                        e.plusMonths(9).plusDays(1),
                        "Pay Corporation Tax",
                        "For the Corporation Tax period ${fmt(s)} to ${fmt(e)} — 9 months and 1 day after it ends. " +
                            "Interest is charged on late payments.",
                        "HMRC", "https://www.gov.uk/pay-corporation-tax",
                    )
                    out += Deadline(
                        e.plusMonths(12),
                        "File Company Tax Return (CT600)",
                        "For ${fmt(s)} to ${fmt(e)}. Due 12 months after the period ends, even if no tax is owed. " +
                            "Late returns start at a £200 penalty (from April 2026).",
                        "HMRC", "https://www.gov.uk/company-tax-returns",
                    )
                }
            }
            var year = 1L
            while (year <= 6) {
                val review = inc.plusYears(year)
                out += Deadline(
                    review.plusDays(14),
                    "File confirmation statement",
                    "Review period ends ${fmt(review)}; file within 14 days (fee £${Rates.CONFIRMATION_FEE.toInt()} online). " +
                        "Check directors, shareholders, PSCs, SIC codes, registered office and email. " +
                        "Directors and PSCs must have verified their identity.",
                    "Companies House", "https://www.gov.uk/file-your-confirmation-statement-with-companies-house",
                )
                year++
            }
        }

        if (profile.vatRegistered) {
            val endMonths = when (profile.vatStagger) {
                2 -> listOf(1, 4, 7, 10)
                3 -> listOf(2, 5, 8, 11)
                else -> listOf(3, 6, 9, 12)
            }
            var d = today.minusMonths(3).withDayOfMonth(1)
            while (d.isBefore(to)) {
                if (d.monthValue in endMonths) {
                    val end = d.with(TemporalAdjusters.lastDayOfMonth())
                    out += Deadline(
                        end.plusMonths(1).plusDays(7),
                        "VAT return and payment",
                        "For the quarter ending ${fmt(end)}. Submit with Making Tax Digital software; " +
                            "allow time for Direct Debit or bank transfer to clear.",
                        "HMRC", "https://www.gov.uk/vat-returns",
                    )
                }
                d = d.plusMonths(1)
            }
        }

        if (profile.runsPayroll) {
            var m = today.minusMonths(1).withDayOfMonth(22)
            while (m.isBefore(today.plusMonths(4))) {
                out += Deadline(
                    m, "Pay PAYE and National Insurance to HMRC",
                    "By the 22nd for electronic payments (19th by post), covering the tax month that ended on the 5th. " +
                        "Remember to send a Full Payment Submission (FPS) on or before every payday.",
                    "HMRC", "https://www.gov.uk/pay-paye-tax",
                )
                m = m.plusMonths(1)
            }
            for (y in today.year - 1..today.year + 1) {
                out += Deadline(LocalDate.of(y, Month.MAY, 31), "Give P60s to employees (including you)",
                    "Every employee on the payroll at 5 April needs a P60.", "HMRC",
                    "https://www.gov.uk/paye-forms-p45-p60-p11d")
                out += Deadline(LocalDate.of(y, Month.JULY, 6), "P11D forms for benefits in kind",
                    "Only if the company provided taxable benefits (e.g. private medical insurance).", "HMRC",
                    "https://www.gov.uk/employer-reporting-expenses-benefits")
            }
        }

        if (profile.selfAssessment) {
            for (y in today.year - 1..today.year + 1) {
                out += Deadline(LocalDate.of(y, Month.JANUARY, 31), "Self Assessment: file online and pay",
                    "Return for the tax year that ended on 5 April ${y - 1}, plus any tax owed and your first payment on account " +
                        "for the current year. £100 penalty if late, even with no tax to pay.",
                    "You (personally)", "https://www.gov.uk/self-assessment-tax-returns/deadlines")
                out += Deadline(LocalDate.of(y, Month.JULY, 31), "Self Assessment: second payment on account",
                    "Only if HMRC has set payments on account for you (usually when your last bill was over £1,000).",
                    "You (personally)", "https://www.gov.uk/understand-self-assessment-bill/payments-on-account")
                out += Deadline(LocalDate.of(y, Month.OCTOBER, 5), "Register for Self Assessment (if new)",
                    "If you need a tax return for the first time for the tax year that ended on 5 April $y " +
                        "(for example, dividends over £10,000), register by today.",
                    "You (personally)", "https://www.gov.uk/register-for-self-assessment")
            }
        }

        profile.icoPaid?.let { paid ->
            var r = paid.plusYears(1)
            while (r.isBefore(today.minusDays(45))) r = r.plusYears(1)
            out += Deadline(r, "Renew ICO data protection fee",
                "The fee is yearly. Paying by Direct Debit saves £5 and renews automatically.",
                "ICO", "https://ico.org.uk/for-organisations/data-protection-fee/")
        }

        return out.filter { !it.date.isBefore(from) && it.date.isBefore(to) }.sortedBy { it.date }
    }

    fun fmt(d: LocalDate): String = d.format(DateTimeFormatter.ofPattern("d MMM yyyy"))

    fun daysUntil(d: LocalDate, today: LocalDate = LocalDate.now()) = ChronoUnit.DAYS.between(today, d)

    fun relative(d: LocalDate, today: LocalDate = LocalDate.now()): String {
        val n = daysUntil(d, today)
        return when {
            n < -1 -> "${-n} days ago"
            n == -1L -> "yesterday"
            n == 0L -> "today"
            n == 1L -> "tomorrow"
            n < 60 -> "in $n days"
            else -> "in ${n / 30} months"
        }
    }
}
