package com.apppilot.companyready

import android.os.Bundle
import android.text.Editable
import android.text.InputType
import android.text.TextWatcher
import android.widget.LinearLayout

object Glossary {
    val terms: List<Pair<String, String>> = listOf(
        "Accounting reference date (ARD)" to "The last day of your company's financial year. Set automatically as the end of the month of your incorporation anniversary; you can change it.",
        "ACSP" to "Authorised Corporate Service Provider — an accountant, solicitor or agent registered with Companies House who can verify identities and file on your behalf.",
        "Annual Investment Allowance (AIA)" to "Lets a business deduct 100% of the cost of qualifying equipment (up to £1 million a year) from profits in the year it's bought.",
        "Articles of association" to "The company's rule book. Most small companies use the standard 'model articles'.",
        "Capital allowances" to "Tax relief on equipment and other assets you keep and use in the business, instead of treating them as day-to-day expenses.",
        "Companies House" to "The UK government's registrar of companies. You register your company, file accounts and confirmation statements here.",
        "Confirmation statement" to "A yearly check (formerly the annual return) confirming your company's details are correct. Fee £50 online.",
        "Corporation Tax" to "Tax a limited company pays on its profits: 19% up to £50,000, 25% over £250,000, with marginal relief in between.",
        "CT600" to "The Company Tax Return sent to HMRC each year, due 12 months after your accounting period ends.",
        "D-U-N-S number" to "A free 9-digit business identifier from Dun & Bradstreet. Google Play and Apple require one for organisation developer accounts.",
        "Director" to "The person who runs the company and has legal duties under the Companies Act 2006.",
        "Director's loan account (DLA)" to "A record of money between you and your company that isn't salary, dividends or expense repayments.",
        "Distributable profits" to "Profits after tax (including those kept from earlier years) that can legally be paid out as dividends.",
        "Dividend" to "A payment to shareholders from the company's profits after Corporation Tax. Taxed at dividend rates, with no National Insurance.",
        "Dividend voucher" to "A document recording a dividend payment: company, date, shareholder, shares held and amount.",
        "Dormant company" to "A company that isn't trading. It must still file accounts and confirmation statements.",
        "Employers' Liability insurance" to "Compulsory insurance (£5m minimum) for most employers, covering injury or illness to employees. Not needed if the only employee is the owner with 50%+ of shares.",
        "Employment Allowance" to "Reduces employer National Insurance by up to £10,500 a year. Not available if the director is the only employee paid above the secondary threshold.",
        "Flat Rate Scheme" to "A simpler VAT scheme: pay a fixed percentage of gross turnover to HMRC. Limited cost traders pay 16.5%.",
        "FPS (Full Payment Submission)" to "The report sent to HMRC on or before every payday when you run payroll.",
        "Government Gateway" to "The sign-in system for HMRC online services, such as your business tax account.",
        "GOV.UK One Login" to "The government sign-in used by Companies House services, including identity verification.",
        "HMRC" to "HM Revenue & Customs — collects Corporation Tax, VAT, PAYE, National Insurance and Self Assessment.",
        "ICO fee" to "A yearly data protection fee paid to the Information Commissioner's Office by most organisations that process personal data. £52 for most micro businesses.",
        "Incorporation" to "Registering a company so it legally exists. Fee £100 online.",
        "Input tax / output tax" to "Input tax is VAT you pay on purchases (reclaimable if registered). Output tax is VAT you charge on sales.",
        "Limited liability" to "Shareholders' risk is limited to what they put in for their shares; the company is responsible for its own debts.",
        "Lower Earnings Limit (LEL)" to "£6,708 a year in 2026/27. Earning at least this through payroll gives you a qualifying year for the State Pension.",
        "Making Tax Digital (MTD)" to "HMRC's rules requiring digital records and compatible software — for all VAT-registered businesses, and from April 2026 for sole traders with income over £50,000.",
        "Marginal relief" to "Reduces Corporation Tax for profits between £50,000 and £250,000.",
        "Merchant of record" to "A company that sells your product on your behalf and takes responsibility for sales tax and VAT (for example Paddle).",
        "Micro-entity" to "A very small company (turnover up to £1 million under current thresholds) that can file simpler accounts.",
        "Minutes" to "A written record of decisions made by directors or shareholders, such as declaring dividends.",
        "National Insurance (NI)" to "A tax on earnings that builds State Pension entitlement. Employees pay 8% (2% above £50,270); employers pay 15% above £5,000.",
        "Outside the scope (of VAT)" to "A supply that isn't subject to UK VAT at all — for example most services supplied to overseas businesses. It doesn't count towards the VAT threshold.",
        "PAYE" to "Pay As You Earn — the system for taking tax and National Insurance from salaries through payroll.",
        "Personal allowance" to "The income you can have tax-free each year: £12,570 (reduced by £1 for every £2 of income over £100,000).",
        "Personal guarantee" to "A personal promise to pay a company's debt if it can't. It overrides limited liability for that debt.",
        "Pre-trading expenses" to "Business costs paid up to 7 years before trading started that can be claimed once you begin.",
        "Professional Indemnity (PI)" to "Insurance covering claims that your professional work caused someone a financial loss.",
        "PSC (person with significant control)" to "Someone who owns more than 25% of shares or votes, or otherwise controls the company. Their details are on the public register.",
        "Registered office" to "The company's official address, shown publicly. Must be an 'appropriate address' in the UK nation where the company is registered.",
        "s455 tax" to "A temporary Corporation Tax charge on director's loans still unpaid 9 months after the year end. Refunded when the loan is repaid.",
        "Self Assessment" to "The personal tax return system. Due by 31 January after the end of the tax year.",
        "Shareholder" to "An owner of the company. Entitled to dividends and votes in proportion to their shares.",
        "SIC code" to "A code describing what your company does, such as 62012 for software development.",
        "Sole trader" to "Self-employed person running a business as an individual, personally responsible for its debts.",
        "Statutory registers" to "Records every company must keep: members, directors, PSCs and charges.",
        "Tax year" to "6 April to 5 April. Used for income tax, National Insurance and dividends — not for Corporation Tax.",
        "Trading allowance" to "Up to £1,000 a year of trading income an individual can earn tax-free.",
        "UTR" to "Unique Taxpayer Reference — a 10-digit number from HMRC for your company (and a separate one for you, if you're in Self Assessment).",
        "VAT" to "Value Added Tax. You must register when taxable turnover goes over £90,000 in any rolling 12 months. Standard rate 20%.",
        "W-8BEN-E" to "A US tax form for non-US companies. Filling it in lets your company claim UK–US treaty benefits on US earnings.",
        "Wholly and exclusively" to "The test for whether a cost is an allowable business expense: it must be for business purposes only.",
        "Wrongful trading" to "Continuing to trade when a director knew, or should have known, the company couldn't avoid insolvency. Can make directors personally liable.",
    ).sortedBy { it.first.lowercase() }
}

class GlossaryActivity : BaseActivity() {
    private lateinit var list: LinearLayout

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setTitles("Glossary", "${Glossary.terms.size} terms explained")
        val search = input("Search terms", content, type = InputType.TYPE_CLASS_TEXT)
        list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        content.addView(list)
        search.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
            override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
            override fun afterTextChanged(s: Editable?) = show(s?.toString() ?: "")
        })
        show("")
    }

    private fun show(q: String) {
        list.removeAllViews()
        val query = q.trim().lowercase()
        val matches = Glossary.terms.filter { query.isEmpty() || it.first.lowercase().contains(query) || it.second.lowercase().contains(query) }
        if (matches.isEmpty()) small("No terms match \"$q\".", list)
        for ((term, meaning) in matches) {
            val c = card(list, 14)
            heading(term, c, 16f)
            body(meaning, c, size = 14.5f)
        }
    }
}
