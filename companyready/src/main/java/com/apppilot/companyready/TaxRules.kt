package com.apppilot.companyready

import kotlin.math.max
import kotlin.math.min

/**
 * UK tax figures used by the calculators, for the 2026/27 tax year (6 April 2026 – 5 April 2027).
 * Income tax bands are for England, Wales and Northern Ireland; Scotland sets its own bands for
 * salary and trading income (dividends use the UK rates everywhere).
 *
 * Update these each April (and after each Budget) from:
 *  - https://www.gov.uk/income-tax-rates
 *  - https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2026-to-2027
 *  - https://www.gov.uk/tax-on-dividends
 *  - https://www.gov.uk/corporation-tax-rates
 *  - https://www.gov.uk/vat-registration
 */
object Rates {
    const val TAX_YEAR = "2026/27"

    const val PERSONAL_ALLOWANCE = 12_570.0
    const val PA_TAPER_START = 100_000.0
    const val BASIC_BAND = 37_700.0              // taxable income taxed at basic rate
    const val ADDITIONAL_THRESHOLD = 125_140.0   // taxable income above this: additional rate
    const val BASIC_RATE = 0.20
    const val HIGHER_RATE = 0.40
    const val ADDITIONAL_RATE = 0.45

    const val DIVIDEND_ALLOWANCE = 500.0
    const val DIV_BASIC = 0.1075
    const val DIV_HIGHER = 0.3575
    const val DIV_ADDITIONAL = 0.3935

    // Employee (Class 1 primary) NI
    const val PRIMARY_THRESHOLD = 12_570.0
    const val UPPER_EARNINGS_LIMIT = 50_270.0
    const val EMPLOYEE_NI_MAIN = 0.08
    const val EMPLOYEE_NI_UPPER = 0.02
    const val LOWER_EARNINGS_LIMIT = 6_708.0

    // Employer (Class 1 secondary) NI
    const val SECONDARY_THRESHOLD = 5_000.0
    const val EMPLOYER_NI = 0.15
    const val EMPLOYMENT_ALLOWANCE = 10_500.0

    // Self-employed Class 4 NI
    const val CLASS4_MAIN = 0.06
    const val CLASS4_UPPER = 0.02

    // Corporation Tax
    const val CT_SMALL_RATE = 0.19
    const val CT_MAIN_RATE = 0.25
    const val CT_LOWER_LIMIT = 50_000.0
    const val CT_UPPER_LIMIT = 250_000.0
    const val CT_MARGINAL_FRACTION = 3.0 / 200.0

    // VAT
    const val VAT_THRESHOLD = 90_000.0
    const val VAT_DEREG_THRESHOLD = 88_000.0
    const val VAT_STANDARD = 0.20

    // Mileage (approved mileage allowance payments, cars and vans)
    const val MILEAGE_FIRST_10K = 0.45
    const val MILEAGE_AFTER = 0.25
    const val HOME_WORKING_WEEKLY = 6.0

    // Filing fees
    const val INCORPORATION_FEE = 100.0
    const val CONFIRMATION_FEE = 50.0
    const val ICO_TIER1_FEE = 52.0
}

object Tax {

    fun personalAllowance(totalIncome: Double): Double {
        val over = max(0.0, totalIncome - Rates.PA_TAPER_START)
        return max(0.0, Rates.PERSONAL_ALLOWANCE - over / 2.0)
    }

    data class PersonalTax(
        val personalAllowance: Double,
        val incomeTaxOnEarnings: Double,
        val dividendTax: Double,
    ) {
        val total get() = incomeTaxOnEarnings + dividendTax
    }

    /**
     * Income tax on earnings (salary or trading profit) plus dividends, with dividends taxed
     * as the top slice of income, as HMRC does.
     */
    fun personalTax(earnings: Double, dividends: Double): PersonalTax {
        val e = max(0.0, earnings)
        val d = max(0.0, dividends)
        val pa = personalAllowance(e + d)
        val earnTaxable = max(0.0, e - pa)
        val paLeft = max(0.0, pa - e)
        val divTaxable = max(0.0, d - paLeft)

        val earnTax = sliceTax(0.0, earnTaxable, Rates.BASIC_RATE, Rates.HIGHER_RATE, Rates.ADDITIONAL_RATE)

        // The dividend allowance is taxed at 0% but still uses up band space.
        val allowance = min(divTaxable, Rates.DIVIDEND_ALLOWANCE)
        val start = earnTaxable + allowance
        val divTax = sliceTax(start, divTaxable - allowance, Rates.DIV_BASIC, Rates.DIV_HIGHER, Rates.DIV_ADDITIONAL)
        return PersonalTax(pa, earnTax, divTax)
    }

    /** Tax on [amount] of taxable income sitting on top of [start] of taxable income. */
    private fun sliceTax(start: Double, amount: Double, basic: Double, higher: Double, additional: Double): Double {
        if (amount <= 0) return 0.0
        val end = start + amount
        val inBasic = overlap(start, end, 0.0, Rates.BASIC_BAND)
        val inHigher = overlap(start, end, Rates.BASIC_BAND, Rates.ADDITIONAL_THRESHOLD)
        val inAdditional = overlap(start, end, Rates.ADDITIONAL_THRESHOLD, Double.MAX_VALUE)
        return inBasic * basic + inHigher * higher + inAdditional * additional
    }

    private fun overlap(a1: Double, a2: Double, b1: Double, b2: Double) = max(0.0, min(a2, b2) - max(a1, b1))

    fun employeeNi(salary: Double): Double {
        val main = max(0.0, min(salary, Rates.UPPER_EARNINGS_LIMIT) - Rates.PRIMARY_THRESHOLD)
        val upper = max(0.0, salary - Rates.UPPER_EARNINGS_LIMIT)
        return main * Rates.EMPLOYEE_NI_MAIN + upper * Rates.EMPLOYEE_NI_UPPER
    }

    fun employerNi(salary: Double, employmentAllowance: Boolean): Double {
        val ni = max(0.0, salary - Rates.SECONDARY_THRESHOLD) * Rates.EMPLOYER_NI
        return if (employmentAllowance) max(0.0, ni - Rates.EMPLOYMENT_ALLOWANCE) else ni
    }

    fun class4(profit: Double): Double {
        val main = max(0.0, min(profit, Rates.UPPER_EARNINGS_LIMIT) - Rates.PRIMARY_THRESHOLD)
        val upper = max(0.0, profit - Rates.UPPER_EARNINGS_LIMIT)
        return main * Rates.CLASS4_MAIN + upper * Rates.CLASS4_UPPER
    }

    /** Corporation Tax for a 12-month period with no associated companies, including marginal relief. */
    fun corporationTax(profit: Double): Double {
        if (profit <= 0) return 0.0
        if (profit <= Rates.CT_LOWER_LIMIT) return profit * Rates.CT_SMALL_RATE
        if (profit >= Rates.CT_UPPER_LIMIT) return profit * Rates.CT_MAIN_RATE
        return profit * Rates.CT_MAIN_RATE - (Rates.CT_UPPER_LIMIT - profit) * Rates.CT_MARGINAL_FRACTION
    }

    data class CompanyResult(
        val profitBeforeSalary: Double,
        val salary: Double,
        val employerNi: Double,
        val taxableProfit: Double,
        val corporationTax: Double,
        val dividends: Double,
        val retained: Double,
        val employeeNi: Double,
        val personal: PersonalTax,
    ) {
        val totalTax get() = employerNi + corporationTax + employeeNi + personal.total
        val takeHome get() = salary - employeeNi + dividends - personal.total
    }

    /**
     * A one-director company paying [salary] and then, as dividends, [dividendShare] (0..1) of the
     * profit left after Corporation Tax. Dividends can never exceed post-tax profit.
     */
    fun company(profit: Double, salary: Double, dividendShare: Double = 1.0, employmentAllowance: Boolean = false): CompanyResult {
        val sal = max(0.0, min(salary, max(0.0, profit)))
        val erNi = employerNi(sal, employmentAllowance)
        val taxable = max(0.0, profit - sal - erNi)
        val ct = corporationTax(taxable)
        val available = max(0.0, taxable - ct)
        val divs = available * dividendShare.coerceIn(0.0, 1.0)
        return CompanyResult(
            profitBeforeSalary = profit,
            salary = sal,
            employerNi = erNi,
            taxableProfit = taxable,
            corporationTax = ct,
            dividends = divs,
            retained = available - divs,
            employeeNi = employeeNi(sal),
            personal = personalTax(sal, divs),
        )
    }

    data class SoleTraderResult(val profit: Double, val personal: PersonalTax, val class4: Double) {
        val totalTax get() = personal.total + class4
        val takeHome get() = profit - totalTax
    }

    fun soleTrader(profit: Double): SoleTraderResult {
        val p = max(0.0, profit)
        return SoleTraderResult(p, personalTax(p, 0.0), class4(p))
    }

    fun vatFromGross(gross: Double, rate: Double = Rates.VAT_STANDARD) = gross - gross / (1 + rate)
    fun addVat(net: Double, rate: Double = Rates.VAT_STANDARD) = net * rate

    fun mileageAllowance(milesBefore: Double, miles: Double): Double {
        val firstBand = max(0.0, min(miles, 10_000.0 - milesBefore))
        return firstBand * Rates.MILEAGE_FIRST_10K + (miles - firstBand) * Rates.MILEAGE_AFTER
    }
}

object Money {
    private val fmt0 = java.text.DecimalFormat("£#,##0")
    private val fmt2 = java.text.DecimalFormat("£#,##0.00")
    fun whole(v: Double): String = if (v < 0) "−" + fmt0.format(-v) else fmt0.format(v)
    fun pounds(v: Double): String = if (v < 0) "−" + fmt2.format(-v) else fmt2.format(v)
    fun pence(p: Long): String = pounds(p / 100.0)

    /** Parses "1,234.56", "£12", "12.5" into pence; null if not a number. */
    fun parsePence(s: String): Long? {
        val clean = s.replace("£", "").replace(",", "").trim()
        if (clean.isEmpty()) return null
        val d = clean.toDoubleOrNull() ?: return null
        return Math.round(d * 100)
    }
}
