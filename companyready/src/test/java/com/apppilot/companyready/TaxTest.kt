package com.apppilot.companyready

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TaxTest {
    private fun near(expected: Double, actual: Double) = assertEquals(expected, actual, 0.01)

    @Test fun corporationTaxBands() {
        near(0.0, Tax.corporationTax(-5.0))
        near(3_800.0, Tax.corporationTax(20_000.0))
        near(9_500.0, Tax.corporationTax(50_000.0))
        // 100k: 25,000 - 150,000 * 3/200 = 22,750
        near(22_750.0, Tax.corporationTax(100_000.0))
        near(62_500.0, Tax.corporationTax(250_000.0))
    }

    @Test fun incomeTaxOnSalary() {
        near(0.0, Tax.personalTax(12_570.0, 0.0).total)
        near(1_486.0, Tax.personalTax(20_000.0, 0.0).total)          // 7,430 * 20%
        near(7_540.0, Tax.personalTax(50_270.0, 0.0).total)          // 37,700 * 20%
        // 110k: PA = 7,570; taxable 102,430 -> 7,540 + (102,430-37,700)*40% = 33,432
        near(33_432.0, Tax.personalTax(110_000.0, 0.0).total)
    }

    @Test fun dividendsStackOnTopAndUseAllowance() {
        // Salary 12,570 uses PA; dividends 10,000: 500 at 0%, 9,500 at 10.75%
        near(1_021.25, Tax.personalTax(12_570.0, 10_000.0).dividendTax)
        // Salary 12,570 + dividends 50,000: taxable divs 50,000; 500 allowance; basic band left 37,200 @10.75, 12,300 @35.75
        val t = Tax.personalTax(12_570.0, 50_000.0)
        near(37_200 * 0.1075 + 12_300 * 0.3575, t.dividendTax)
        // Unused personal allowance covers dividends first
        near(0.0, Tax.personalTax(0.0, 12_000.0).total)
    }

    @Test fun nationalInsurance() {
        near(0.0, Tax.employeeNi(12_570.0))
        near(3_016.0, Tax.employeeNi(50_270.0))
        near(3_016.0 + 194.6, Tax.employeeNi(60_000.0))
        near(0.0, Tax.employerNi(5_000.0, false))
        near(1_135.5, Tax.employerNi(12_570.0, false))
        near(0.0, Tax.employerNi(12_570.0, true))
        near(2_262.0, Tax.class4(50_270.0))
    }

    @Test fun companyNeverPaysMoreDividendsThanPostTaxProfit() {
        val r = Tax.company(50_000.0, 12_570.0)
        val taxable = 50_000 - 12_570 - 1_135.5
        near(taxable, r.taxableProfit)
        near(taxable * 0.81, r.dividends)
        near(0.0, r.retained)
        assertTrue(r.takeHome > 0)
        val small = Tax.company(3_000.0, 12_570.0)
        near(3_000.0, small.salary)
    }

    @Test fun soleTraderTakeHome() {
        val s = Tax.soleTrader(30_000.0)
        near(3_486.0, s.personal.total)
        near(1_045.8, s.class4)
        near(30_000 - 3_486 - 1_045.8, s.takeHome)
    }

    @Test fun vatAndMileage() {
        near(20.0, Tax.vatFromGross(120.0))
        near(24.0, Tax.addVat(120.0))
        near(135.0, Tax.mileageAllowance(0.0, 300.0))
        near(100 * 0.45 + 100 * 0.25, Tax.mileageAllowance(9_900.0, 200.0))
    }

    @Test fun moneyParsing() {
        assertEquals(123456L, Money.parsePence("£1,234.56"))
        assertEquals(1250L, Money.parsePence("12.5"))
        assertEquals(null, Money.parsePence("abc"))
        assertEquals("£1,234.56", Money.pence(123456))
    }
}
