package com.apppilot.companyready

/** Steps 5–8: HMRC registrations, VAT, insurance, and spending/claiming back. */
object JourneyB {
    val steps = listOf(
        Step(
            id = "hmrc",
            title = "Register with HMRC for tax",
            summary = "Corporation Tax, PAYE payroll for your salary, and your own Self Assessment — what to register for and when.",
            minutes = 14,
            icon = "🧾",
            lessons = listOf(
                Lesson(
                    "Corporation Tax: make sure you're set up",
                    """
                    When you register online with Companies House, your company is **usually set up for Corporation Tax automatically**. HMRC then posts the company's **UTR** to your registered office.

                    **If it wasn't set up** (for example, you registered it as dormant or through some agents), you must register within **3 months** of starting to do business. "Doing business" includes buying, selling, advertising, renting a property or employing someone. You do this in the company's **business tax account** (a Government Gateway account for the company) using the UTR.

                    Either way, keep the HMRC letters: they confirm your accounting period and the dates your first return and payment are due.

                    **Rates (from 1 April 2023, unchanged for ${Rates.TAX_YEAR}):**
                    • **19%** on profits up to £50,000 (small profits rate)
                    • **25%** on profits over £250,000 (main rate)
                    • in between, 25% with **marginal relief**, giving an effective rate on the extra profit of 26.5%

                    **Deadlines each year:**
                    • **Pay** Corporation Tax **9 months and 1 day** after your accounting period ends
                    • **File** the Company Tax Return (CT600) **12 months** after it ends. HMRC's free filing service closed in March 2026, so returns are filed with commercial software (or by your accountant).

                    Your company pays Corporation Tax on its profits — not on all the money it receives — so good expense records directly reduce the bill.
                    """.trimIndent(),
                ),
                Lesson(
                    "PAYE: register as an employer to pay yourself a salary",
                    """
                    If you pay yourself (or anyone) a salary, the company must register as an **employer** with HMRC **before the first payday**. It can take up to 15 working days to get your employer PAYE reference, so do it early.

                    **Running payroll each time you pay:**
                    • Use payroll software (HMRC's free Basic PAYE Tools works for up to 9 employees, and most accounting software includes payroll)
                    • Send a **Full Payment Submission (FPS)** to HMRC **on or before** each payday
                    • Pay any PAYE tax and NI to HMRC by the **22nd** of the following month (if paying electronically)
                    • Give yourself a payslip, and a **P60** after each tax year (by 31 May)

                    If your salary is below the thresholds, there may be nothing to pay — but you still report it.
                    """.trimIndent(),
                ),
                Lesson(
                    "Workplace pensions (auto-enrolment)",
                    """
                    If you're the **only director and only employee**, and there's no employment contract, the company usually **doesn't have to** auto-enrol you in a pension. But you should tell **The Pensions Regulator** that you have no duties, using its online tool.

                    If you take on staff, you'll need to auto-enrol eligible workers and pay contributions.

                    Company pension contributions for yourself are usually a **tax-deductible expense** for the company, and free of National Insurance — one of the most tax-efficient ways to extract profit.
                    """.trimIndent(),
                ),
                Lesson(
                    "Self Assessment for you personally",
                    """
                    As a director you might need a personal **Self Assessment** tax return. You **must** file one if, for example:
                    • you get dividends of more than **£10,000** in a tax year
                    • you have income over £150,000, or untaxed income over £2,500 (such as rental income)
                    • you're also a sole trader or partner earning over £1,000

                    If your dividends are over £500 but under £10,000 you still owe tax on them: HMRC can collect it through your tax code if you tell them, or you can file a return.

                    **Key dates:** register by **5 October** after the end of the tax year; file online and pay by **31 January**; payments on account due 31 January and 31 July.

                    **Sole traders:** you register for Self Assessment instead of Corporation Tax. **Making Tax Digital for Income Tax** started in April 2026 for sole traders and landlords with qualifying income over £50,000, dropping to £30,000 from April 2027 and £20,000 from April 2028. You'll need compatible software and quarterly updates.
                    """.trimIndent(),
                ),
            ),
            tasks = listOf(
                Task("hmrc.gateway", "Created a Government Gateway / business tax account for the company"),
                Task("hmrc.ct", "Checked the company is set up for Corporation Tax (or registered it within 3 months of starting to trade)",
                    link = Link("Set up your company for Corporation Tax", "https://www.gov.uk/limited-company-formation/set-up-your-company-for-corporation-tax")),
                Task("hmrc.paye", "Registered as an employer for PAYE before the first salary payment",
                    link = Link("Register as an employer", "https://www.gov.uk/register-employer")),
                Task("hmrc.payroll", "Chosen payroll software (Basic PAYE Tools, or the payroll in my accounting software)"),
                Task("hmrc.pension", "Completed The Pensions Regulator's duties checker (declaration of no duty if I'm the only employee)",
                    link = Link("Workplace pension duties for employers", "https://www.thepensionsregulator.gov.uk/en/employers")),
                Task("hmrc.sa", "Checked whether I need a personal Self Assessment return",
                    link = Link("Check if you need a tax return", "https://www.gov.uk/check-if-you-need-tax-return")),
            ),
            links = listOf(
                Link("Corporation Tax overview", "https://www.gov.uk/corporation-tax", "GOV.UK"),
                Link("Corporation Tax rates and reliefs", "https://www.gov.uk/corporation-tax-rates", "GOV.UK"),
                Link("Company Tax Returns", "https://www.gov.uk/company-tax-returns", "GOV.UK"),
                Link("PAYE and payroll for employers", "https://www.gov.uk/paye-for-employers", "GOV.UK"),
                Link("Basic PAYE Tools (free payroll software)", "https://www.gov.uk/basic-paye-tools", "HMRC"),
                Link("Register for Self Assessment", "https://www.gov.uk/register-for-self-assessment", "GOV.UK"),
                Link("Making Tax Digital for Income Tax", "https://www.gov.uk/guidance/check-if-youre-eligible-for-making-tax-digital-for-income-tax", "Sole traders"),
                Link("HMRC webinars and videos", "https://www.gov.uk/government/collections/hmrc-webinars-email-alerts-and-videos", "Free training"),
            ),
            quiz = listOf(
                Question(
                    "Your company wasn't set up for Corporation Tax when it was registered. When must you register it?",
                    listOf("Within 3 months of starting to do business", "Before you incorporate", "At the end of the first year"),
                    0,
                    "You have 3 months from starting to do business (buying, selling, advertising or employing). Most companies registered online are set up automatically.",
                ),
                Question(
                    "Your accounting period ends on 31 March 2027. When is the Corporation Tax payment due?",
                    listOf("31 March 2028", "1 January 2028", "31 January 2028"),
                    1,
                    "Payment is due 9 months and 1 day after the period ends — 1 January 2028. The return (CT600) is due on 31 March 2028.",
                ),
                Question(
                    "When must you register as an employer for PAYE?",
                    listOf("Before the first payday", "Within a year of incorporating", "Only if you hire staff other than yourself"),
                    0,
                    "Register before you first pay anyone — including yourself as director. It can take up to 15 working days.",
                ),
            ),
            tools = listOf(Tool.DEADLINES),
        ),

        Step(
            id = "vat",
            title = "VAT: when and how",
            summary = "The £90,000 threshold, the rolling 12-month test, voluntary registration, schemes, Making Tax Digital, and how app store sales are treated.",
            minutes = 15,
            icon = "💷",
            lessons = listOf(
                Lesson(
                    "When you must register",
                    """
                    You **must** register for VAT if either:
                    • your **VAT taxable turnover** for the **last 12 months** (a rolling period, not the tax year) went over **£${"%,d".format(java.util.Locale.UK, Rates.VAT_THRESHOLD.toInt())}** — register within **30 days** of the end of the month you went over
                    • you expect turnover to go over £90,000 in the **next 30 days alone** — register straight away

                    Check the rolling total at the end of **every month**. Your registration takes effect from the first day of the second month after you went over, and you must charge VAT from then, whether or not you have your number yet.

                    Deregistration threshold: £${"%,d".format(java.util.Locale.UK, Rates.VAT_DEREG_THRESHOLD.toInt())}.
                    """.trimIndent(),
                    warning = "Registering late means paying the VAT you should have charged out of your own pocket, plus penalties. The app's VAT checker uses your records to warn you as you get close.",
                ),
                Lesson(
                    "App store sales and VAT (important for developers)",
                    """
                    When you sell apps or in-app purchases through **Google Play** or the **Apple App Store**, the store is treated as selling to the customer. Google and Apple charge and pay VAT to the UK and other countries on those consumer sales.

                    Your company is normally supplying a service **to the store** (Google Commerce Ltd and Apple Distribution International are both in Ireland). A service supplied to a business outside the UK is usually **outside the scope of UK VAT**, so these payouts often **don't count** towards your £90,000 UK VAT threshold. The same usually applies to ad revenue paid by overseas ad networks such as Google AdMob.

                    **What does count:** sales you make **directly** (your own website, Stripe or PayPal checkout, consulting, freelance development for UK clients).

                    **Selling directly to consumers in the EU** (not through a store) means EU VAT from the first euro, normally through the EU's **non-Union One Stop Shop**. Using a "merchant of record" payment provider (such as Paddle or Lemon Squeezy) moves this job onto them.

                    These rules depend on exactly who the customer is in each contract, so confirm your position with your accountant.
                    """.trimIndent(),
                    tip = "In the records tool, app store payouts default to \"doesn't count towards VAT turnover\". You can change this per entry if your accountant advises otherwise.",
                ),
                Lesson(
                    "Should you register voluntarily?",
                    """
                    You can register below the threshold.

                    **Benefits:**
                    • you can **reclaim VAT** on business purchases (laptops, phones, software, accountancy)
                    • some business clients see it as a sign of an established business
                    • if your customers are mainly app stores or overseas businesses (outside the scope of UK VAT but with recovery rights), you may reclaim input VAT without adding VAT to your income

                    **Drawbacks:**
                    • UK consumers buying directly from you pay 20% more, or you absorb it
                    • quarterly returns, digital records and stricter invoices
                    • penalties for late returns

                    Get advice before registering voluntarily — the right answer depends on who your customers are.
                    """.trimIndent(),
                ),
                Lesson(
                    "Rates, schemes and Making Tax Digital",
                    """
                    **Rates:** 20% standard (most digital services and software), 5% reduced, 0% zero-rated (for example most books and e-books).

                    **Schemes that can save admin or money:**
                    • **Flat Rate Scheme** — pay a fixed % of your gross turnover instead of working out VAT on every purchase. Most software businesses count as **limited cost traders** (16.5%) because they buy few goods, which often removes the benefit.
                    • **Cash Accounting** — pay VAT when customers pay you, not when you invoice
                    • **Annual Accounting** — one return a year with advance payments

                    **Making Tax Digital (MTD):** all VAT-registered businesses must keep **digital records** and file returns with **MTD-compatible software**. Returns are usually quarterly; you file and pay **1 month and 7 days** after the quarter ends.

                    **VAT invoices** must show your VAT number, invoice number, date, your business name and address, the customer's details, a description, the net amount, VAT rate and VAT amount.
                    """.trimIndent(),
                ),
            ),
            tasks = listOf(
                Task("vat.understand", "I understand the £90,000 rolling 12-month test and the 30-day forward test"),
                Task("vat.sources", "Listed my income sources and which count towards UK VAT taxable turnover (store payouts vs direct sales)"),
                Task("vat.check", "Set up a monthly reminder to check my rolling 12-month turnover in the VAT checker"),
                Task("vat.decide", "Decided with my accountant whether to register now, voluntarily, or wait until required",
                    link = Link("Register for VAT", "https://www.gov.uk/register-for-vat")),
                Task("vat.mtd", "If registered: chosen MTD-compatible software and entered my VAT quarters in Deadlines",
                    link = Link("Find software for Making Tax Digital for VAT", "https://www.gov.uk/guidance/find-software-thats-compatible-with-making-tax-digital-for-vat")),
                Task("vat.eu", "Checked whether I sell directly to EU consumers (and need OSS or a merchant of record)"),
            ),
            links = listOf(
                Link("VAT registration", "https://www.gov.uk/vat-registration", "Threshold and rules"),
                Link("VAT rates", "https://www.gov.uk/vat-rates", "GOV.UK"),
                Link("VAT Flat Rate Scheme", "https://www.gov.uk/vat-flat-rate-scheme", "GOV.UK"),
                Link("VAT Cash Accounting Scheme", "https://www.gov.uk/vat-cash-accounting-scheme", "GOV.UK"),
                Link("Making Tax Digital for VAT", "https://www.gov.uk/guidance/making-tax-digital-for-vat", "GOV.UK"),
                Link("VAT: digital services to consumers", "https://www.gov.uk/guidance/the-vat-rules-if-you-supply-digital-services-to-private-consumers", "HMRC guidance"),
                Link("Place of supply of services (VAT Notice 741A)", "https://www.gov.uk/guidance/vat-place-of-supply-of-services-notice-741a", "HMRC"),
                Link("EU VAT One Stop Shop", "https://vat-one-stop-shop.ec.europa.eu/index_en", "European Commission"),
            ),
            quiz = listOf(
                Question(
                    "How is the VAT registration threshold measured?",
                    listOf("By tax year (April to April)", "On a rolling 12 months, checked at each month end", "By calendar year"),
                    1,
                    "It's a rolling 12-month total of VAT taxable turnover. Check it at the end of every month.",
                ),
                Question(
                    "You pass £90,000 rolling turnover at the end of June. When must you register?",
                    listOf("By 30 July", "By the end of the tax year", "Next January"),
                    0,
                    "Within 30 days of the end of the month you went over — so by 30 July.",
                ),
                Question(
                    "Why might app store payouts not count towards your UK VAT threshold?",
                    listOf("Apps are always zero-rated",
                        "You're usually supplying the store (based outside the UK), which is outside the scope of UK VAT",
                        "Small developers are exempt from VAT"),
                    1,
                    "The store is treated as the seller to consumers. Your supply to an overseas business is usually outside the scope of UK VAT. Confirm with your accountant.",
                ),
            ),
            tools = listOf(Tool.VAT_CHECK),
        ),

        Step(
            id = "insurance",
            title = "Insurance and protecting yourself",
            summary = "Which insurance you need (and which is optional), plus data protection registration and protecting your brand.",
            minutes = 12,
            icon = "🛡️",
            lessons = listOf(
                Lesson(
                    "Compulsory: Employers' Liability insurance",
                    """
                    Most companies with employees **must** have **Employers' Liability (EL)** insurance with at least **£5 million** of cover, and display the certificate (electronically is fine). Fines are up to £2,500 for every day without it.

                    **Exemption:** you don't need EL if your company only employs **you as the owner**, holding 50% or more of the shares. As soon as you hire someone (even part-time or casual), you do.
                    """.trimIndent(),
                ),
                Lesson(
                    "Strongly recommended for app developers",
                    """
                    **Professional Indemnity (PI)** — covers claims that your work or advice caused a financial loss: a bug that corrupts a client's data, a missed deadline, a feature that doesn't work as promised, or accidental infringement of someone's intellectual property. This is the **main policy protecting you from being sued** as a software business. Many clients insist on £1m+.

                    **Cyber insurance** — covers data breaches, hacking, ransomware, the cost of notifying users and regulators, and business interruption. Essential if your apps store user accounts, personal data or payments.

                    **Public Liability (PL)** — covers injury to people or damage to their property from your business activities (for example at a client's office or an event). Often bundled cheaply with PI.

                    **Product Liability** — covers harm caused by a product you supply. For pure software it's mostly covered under PI, but check if you make hardware or companion devices.
                    """.trimIndent(),
                ),
                Lesson(
                    "Worth considering",
                    """
                    • **Directors' and Officers' (D&O)** — covers you personally against claims about your decisions as a director
                    • **Business equipment / contents** — laptops, phones and test devices, including away from home; home insurance often excludes business equipment
                    • **Legal expenses** — pays legal costs for disputes (contracts, debt recovery)
                    • **Tax investigation insurance** — pays accountancy fees if HMRC opens an enquiry (often offered by accountants)
                    • **Business use car insurance** — needed if you drive for business (to clients or the post office), not just commuting
                    • **Tell your home insurer and mortgage lender / landlord** that you work from home

                    **Typical costs** for a one-person software company: PI £150–£500 a year, cyber £150–£600, PL £50–£150. Prices depend on turnover, the type of apps, and the cover limit.
                    """.trimIndent(),
                    tip = "A broker who knows tech businesses can bundle PI, cyber and PL into one policy. Read the exclusions — some PI policies exclude contractual liability or US clients.",
                ),
                Lesson(
                    "Data protection: the ICO fee and UK GDPR",
                    """
                    If your company processes personal data electronically — user accounts, emails, analytics, crash reports with identifiers, customer records — it probably needs to pay the **Information Commissioner's Office (ICO) data protection fee**. For most micro businesses it's **£${Rates.ICO_TIER1_FEE.toInt()} a year** (£5 less by Direct Debit). Use the ICO's self-assessment to check. Not paying can mean a fine of up to £4,350.

                    **UK GDPR basics for apps:**
                    • publish a clear **privacy policy** (Google Play requires one for most apps)
                    • only collect data you need, have a lawful basis, and keep it secure
                    • get **consent** for non-essential cookies and tracking (including in-app analytics SDKs, where required)
                    • be ready to handle data access and deletion requests, and report serious breaches to the ICO within 72 hours
                    • complete Google Play's **Data safety** form accurately
                    """.trimIndent(),
                ),
                Lesson(
                    "Contracts, terms and your intellectual property",
                    """
                    • **App terms of use / EULA** — limit your liability as far as the law allows (you can't exclude liability for death or injury caused by negligence, and consumer rights can't be removed)
                    • **Client contracts** — for freelance work, agree who owns the code, payment terms and a liability cap
                    • **Trade marks** — register your app or studio name with the UK Intellectual Property Office (from £170 online for one class, plus £50 for each additional class)
                    • **Copyright** — your code is protected automatically; keep dated records and use version control
                    • **Open-source licences** — follow the terms of libraries you use (attribution, copyleft)
                    """.trimIndent(),
                ),
            ),
            tasks = listOf(
                Task("ins.el", "Checked whether I need Employers' Liability (only needed once I employ someone other than me as majority owner)",
                    link = Link("Employers' liability insurance", "https://www.gov.uk/employers-liability-insurance")),
                Task("ins.pi", "Got quotes for Professional Indemnity insurance"),
                Task("ins.cyber", "Got quotes for Cyber insurance (essential if my apps hold user data or take payments)"),
                Task("ins.pl", "Decided on Public Liability and equipment cover"),
                Task("ins.home", "Told my home insurer (and mortgage lender or landlord) that I work from home"),
                Task("ins.ico", "Checked and paid the ICO data protection fee if needed",
                    link = Link("ICO fee self-assessment", "https://ico.org.uk/for-organisations/data-protection-fee/self-assessment/")),
                Task("ins.privacy", "Written a privacy policy and app terms for my apps"),
                Task("ins.tm", "Decided whether to register a trade mark for my app or studio name"),
            ),
            links = listOf(
                Link("Employers' liability insurance", "https://www.gov.uk/employers-liability-insurance", "GOV.UK"),
                Link("ICO data protection fee", "https://ico.org.uk/for-organisations/data-protection-fee/", "ICO"),
                Link("UK GDPR guidance for small businesses", "https://ico.org.uk/for-organisations/advice-for-small-organisations/", "ICO"),
                Link("Find an insurance broker", "https://www.biba.org.uk/", "British Insurance Brokers' Association"),
                Link("Association of British Insurers", "https://www.abi.org.uk/", "Guides to business insurance"),
                Link("How to register a trade mark", "https://www.gov.uk/how-to-register-a-trade-mark", "Intellectual Property Office"),
                Link("Business Companion (Trading Standards)", "https://www.businesscompanion.info/", "Consumer law guidance"),
            ),
            quiz = listOf(
                Question(
                    "You're the only person in your company and own all the shares. Do you legally need Employers' Liability insurance?",
                    listOf("Yes, always", "No — you're exempt until you employ someone else", "Only if you earn over £90,000"),
                    1,
                    "Companies whose only employee is the owner holding 50%+ of the shares are exempt. Hire anyone else and you need it.",
                ),
                Question(
                    "A bug in an app you built for a client wipes their customer data and they claim £40,000. Which policy is designed for this?",
                    listOf("Public Liability", "Professional Indemnity", "Employers' Liability"),
                    1,
                    "Professional Indemnity covers financial loss caused by mistakes in your professional work. Cyber insurance may also respond to the data side.",
                ),
                Question(
                    "Your app has user accounts with email addresses. What should you check with the ICO?",
                    listOf("Whether you must pay the data protection fee", "Whether you need a VAT number", "Nothing, apps are exempt"),
                    0,
                    "Most businesses processing personal data electronically pay the ICO fee (£52 a year for most micro businesses).",
                ),
            ),
        ),

        Step(
            id = "expenses",
            title = "Buying things and claiming them back",
            summary = "How to pay for business costs, what's allowable, how to reclaim things you paid personally, and the allowances that save tax.",
            minutes = 15,
            icon = "🧮",
            lessons = listOf(
                Lesson(
                    "The golden rule: wholly and exclusively",
                    """
                    A cost reduces your company's taxable profit if it's incurred **wholly and exclusively for the business**. If something is partly personal (like your home broadband), only the business part can be claimed, and some costs are never allowed.

                    **Keep evidence for every purchase:** a receipt or invoice showing the supplier, date, what was bought and the amount (and VAT, if any). A photo of the receipt is fine — attach it to the entry in the app.
                    """.trimIndent(),
                ),
                Lesson(
                    "Three ways to pay for business things",
                    """
                    **1. Pay from the company account or company card (best).** The cleanest option: the bank statement matches your records.

                    **2. Pay personally and claim it back.** Fine for the odd purchase. Keep the receipt, record it as an expense **paid personally**, and the company owes you. Repay yourself from the company account (tax-free). The app tracks what the company owes you in your **director's loan** balance.

                    **3. Buy before the company existed.** Costs you paid in the **7 years before trading started** (for example a laptop or developer account) can be claimed as **pre-trading expenses**, if they'd have been allowable once trading. Record them and the company repays you or owes you via the director's loan.

                    **Make sure the invoice is in the company's name** where possible, especially if you're VAT registered (you need a valid VAT invoice to reclaim VAT).
                    """.trimIndent(),
                ),
                Lesson(
                    "Common allowable costs for app developers",
                    """
                    • **Computers, phones and test devices** (claimed via capital allowances, usually 100% in the year you buy them)
                    • **Software and subscriptions**: IDEs, design tools, cloud services, GitHub, AI tools, analytics
                    • **Developer accounts**: Google Play ($25 one-off), Apple Developer Program (£79/year)
                    • **Hosting, domains, email, APIs and cloud bills**
                    • **Accountant, legal and professional fees**, Companies House and ICO fees
                    • **Business insurance**
                    • **Advertising and marketing**: app store ads, social ads, website
                    • **Training, courses and books** that maintain or update your existing skills
                    • **Travel** to temporary places of work, clients and conferences (not your normal commute)
                    • **Bank charges**, payment processing fees
                    • **Freelancers and contractors** (designers, testers, translators)
                    • **Salary and employer NI** for you and staff, and **company pension contributions**
                    • **One mobile phone contract** in the company's name, used by you (no benefit in kind)
                    """.trimIndent(),
                ),
                Lesson(
                    "Working from home and mileage",
                    """
                    **Use of home:** the company can pay you **£6 a week** (£26 a month) to cover extra household costs from working at home, with no receipts needed and no tax for you. Claiming more needs evidence of the actual extra costs, or a formal arrangement with your accountant.

                    **Mileage:** if you use your own car for business journeys, the company can pay you tax-free:
                    • **45p a mile** for the first 10,000 business miles in the tax year
                    • **25p a mile** after that
                    (24p a mile for motorbikes, 20p for bikes.) Keep a log: date, from/to, purpose and miles. Your normal commute doesn't count.

                    The app has a **mileage log** that calculates this for you.
                    """.trimIndent(),
                ),
                Lesson(
                    "What you can't claim",
                    """
                    • **Client entertainment** (meals, drinks or events for customers or prospects) — record it, but it isn't tax-deductible for Corporation Tax and you can't reclaim the VAT
                    • **Personal items**: everyday clothing, your lunch on normal working days, gym memberships, personal phone bills
                    • **Commuting** to a permanent workplace
                    • **Fines and penalties**, including parking tickets and HMRC late penalties
                    • **Dividends and Corporation Tax** themselves (they're not expenses)

                    **Staff events and gifts:** a yearly staff party up to **£150 a head** and "trivial benefits" up to **£50** each (directors are capped at £300 a year) are tax-free.
                    """.trimIndent(),
                    warning = "Paying personal costs from the company account without recording them as director's loan or salary can lead to tax, interest and penalties. If in doubt, record it and ask your accountant.",
                ),
                Lesson(
                    "Capital allowances for equipment",
                    """
                    Bigger items you keep and use for more than a year (laptops, phones, monitors, desks) are **capital assets**. Instead of being an everyday expense, they're claimed through **capital allowances**:
                    • the **Annual Investment Allowance** lets the company deduct **100%** of qualifying equipment costs up to £1 million a year
                    • companies can also claim **full expensing** on new main-rate plant and machinery
                    • **cars** are different: allowances depend on CO₂ emissions (new zero-emission cars qualify for 100% first-year allowance)

                    Record equipment in the app under "Equipment & computers" and your accountant will claim the right allowance.
                    """.trimIndent(),
                ),
            ),
            tasks = listOf(
                Task("exp.card", "Got a company debit card and use it for business purchases"),
                Task("exp.receipts", "Set up a habit to photograph and record receipts the same day (attach them in Records)"),
                Task("exp.pretrading", "Recorded pre-trading expenses I paid personally (laptop, developer accounts, domain)"),
                Task("exp.reimburse", "Know how to reclaim personal spending: record as paid personally, then repay myself"),
                Task("exp.home", "Decided whether the company pays me £6 a week for working from home"),
                Task("exp.mileage", "Started a mileage log for business journeys"),
                Task("exp.disallowed", "I understand client entertainment, commuting, fines and personal items aren't allowable"),
            ),
            links = listOf(
                Link("Expenses and benefits A to Z", "https://www.gov.uk/expenses-and-benefits-a-to-z", "For companies and employers"),
                Link("Expenses if you're self-employed", "https://www.gov.uk/expenses-if-youre-self-employed", "Sole traders"),
                Link("Homeworking expenses", "https://www.gov.uk/expenses-and-benefits-homeworking", "GOV.UK"),
                Link("Business travel and mileage", "https://www.gov.uk/expenses-and-benefits-business-travel-mileage/rules-for-tax", "Mileage rates"),
                Link("Capital allowances", "https://www.gov.uk/capital-allowances", "GOV.UK"),
                Link("Annual Investment Allowance", "https://www.gov.uk/capital-allowances/annual-investment-allowance", "GOV.UK"),
                Link("Mobile phones (expenses and benefits)", "https://www.gov.uk/expenses-and-benefits-mobile-phones", "GOV.UK"),
                Link("Trivial benefits", "https://www.gov.uk/expenses-and-benefits-trivial-benefits", "GOV.UK"),
            ),
            quiz = listOf(
                Question(
                    "You buy a £1,200 laptop for the business with your personal card. What should you do?",
                    listOf("Nothing — it's yours now", "Record it as an expense paid personally, keep the receipt, and repay yourself from the company", "Pay yourself a £1,200 dividend"),
                    1,
                    "The company owes you £1,200. Repaying you is tax-free, and the laptop qualifies for capital allowances.",
                ),
                Question(
                    "You take a potential client out for dinner. Can the company deduct it from profits for Corporation Tax?",
                    listOf("Yes, it's a business cost", "No — client entertainment isn't deductible", "Only half of it"),
                    1,
                    "Client entertainment isn't allowable for Corporation Tax and its VAT can't be reclaimed. Record it anyway.",
                ),
                Question(
                    "You drive 300 business miles this tax year in your own car. How much can the company pay you tax-free?",
                    listOf("£75", "£135", "£300"),
                    1,
                    "300 miles × 45p = £135 (the first 10,000 miles are at 45p a mile).",
                ),
            ),
            tools = listOf(Tool.RECORDS, Tool.MILEAGE),
        ),
    )
}
