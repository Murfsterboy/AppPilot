package com.apppilot.companyready

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class DeadlinesTest {
    private fun d(s: String) = LocalDate.parse(s)

    @Test fun firstPeriodEndDefaultsToAnniversaryMonthEnd() {
        assertEquals(d("2027-03-31"), DeadlineEngine.firstPeriodEnd(d("2026-03-10"), null))
        assertEquals(d("2027-02-28"), DeadlineEngine.firstPeriodEnd(d("2026-02-14"), null))
    }

    @Test fun customYearEndMustBeOverSixMonthsAway() {
        // Incorporated 10 Mar 2026, year end March -> 31 Mar 2027 (31 Mar 2026 is too soon)
        assertEquals(d("2027-03-31"), DeadlineEngine.firstPeriodEnd(d("2026-03-10"), 3))
        // Year end December -> 31 Dec 2026 (over 6 months)
        assertEquals(d("2026-12-31"), DeadlineEngine.firstPeriodEnd(d("2026-03-10"), 12))
        // Year end June -> 30 Jun 2026 is under 6 months, so 30 Jun 2027
        assertEquals(d("2027-06-30"), DeadlineEngine.firstPeriodEnd(d("2026-03-10"), 6))
    }

    @Test fun firstAccountsDue21MonthsAfterIncorporation() {
        val inc = d("2026-03-10")
        val first = DeadlineEngine.companyPeriods(inc, null, 2)
        assertEquals(d("2027-12-10"), DeadlineEngine.accountsDue(first[0], inc))
        // Second period ends 31 Mar 2028 -> due 31 Dec 2028
        assertEquals(d("2028-03-31"), first[1].end)
        assertEquals(d("2028-12-31"), DeadlineEngine.accountsDue(first[1], inc))
    }

    @Test fun shortFirstPeriodUsesNineMonths() {
        val inc = d("2026-03-10")
        val p = DeadlineEngine.companyPeriods(inc, 12, 1)[0]
        assertEquals(d("2027-09-30"), DeadlineEngine.accountsDue(p, inc))
    }

    @Test fun longFirstPeriodSplitsForCorporationTax() {
        val inc = d("2026-03-10")
        val p = DeadlineEngine.companyPeriods(inc, null, 1)[0]
        val ct = DeadlineEngine.ctPeriods(p)
        assertEquals(2, ct.size)
        assertEquals(d("2027-03-09"), ct[0].second)
        assertEquals(d("2027-03-10") to d("2027-03-31"), ct[1])
    }

    @Test fun allDeadlinesSortedAndIncludeKeyItems() {
        val profile = CompanyProfile(d("2026-03-10"), null, vatRegistered = true, vatStagger = 1, runsPayroll = true)
        val list = DeadlineEngine.all(profile, d("2027-01-01"))
        assertEquals(list.sortedBy { it.date }, list)
        assertTrue(list.any { it.title.startsWith("File confirmation statement") && it.date == d("2027-03-24") })
        assertTrue(list.any { it.title == "VAT return and payment" && it.date == d("2027-02-07") })
        assertTrue(list.any { it.title.startsWith("Self Assessment: file") && it.date == d("2027-01-31") })
    }

    @Test fun taxYearBoundaries() {
        assertEquals(d("2026-04-06"), Books.taxYear(d("2026-04-06")).from)
        assertEquals(d("2025-04-06"), Books.taxYear(d("2026-04-05")).from)
    }
}
