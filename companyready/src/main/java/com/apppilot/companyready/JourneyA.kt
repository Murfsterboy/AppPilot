package com.apppilot.companyready

/** Steps 1–4: choosing a structure, planning, registering, and banking/paying yourself. */
object JourneyA {
    val steps = listOf(
        Step(
            id = "structure",
            title = "Sole trader or limited company?",
            summary = "Understand your options, what \"limited liability\" really protects, and whether a company is right for you.",
            minutes = 12,
            icon = "⚖️",
            lessons = listOf(
                Lesson(
                    "The two main ways to be self-employed",
                    """
                    In the UK most one-person businesses are either a **sole trader** or a **private limited company** (Ltd).

                    **Sole trader:** you and the business are legally the same person. Setting up takes minutes: you register for Self Assessment with HMRC. Profits are taxed as your income, and you're personally responsible for all business debts and claims.

                    **Limited company:** the company is a separate legal "person". It signs contracts, owns things, earns the money and pays its own tax (Corporation Tax). You're a **director** (you run it) and a **shareholder** (you own it). You take money out as salary and dividends.

                    There are also partnerships and LLPs for two or more people, but this app focuses on the one-person limited company and compares it with sole trading.
                    """.trimIndent(),
                ),
                Lesson(
                    "What limited liability protects — and what it doesn't",
                    """
                    If the **company** is sued or can't pay its debts, your personal money, home and car are normally protected. Your risk is limited to what you put into the company (usually £1 for your share) plus anything you've guaranteed.

                    **It does not protect you if:**
                    • you sign a **personal guarantee** (common with business loans, leases and some bank accounts)
                    • you act fraudulently, or keep trading when you know the company can't pay its debts (**wrongful trading**)
                    • you personally cause harm (for example, you personally infringe someone's copyright or trade mark)
                    • you break your **director's duties** under the Companies Act 2006
                    • the company owes tax because of deliberate non-payment — HMRC can make directors personally liable in some cases
                    • you mix personal and company money so a court treats them as one

                    **That's why you still need insurance** (Step 7). Limited liability stops a claim reaching your house; insurance pays the claim so the company survives it.
                    """.trimIndent(),
                    warning = "A limited company doesn't make you immune from being sued. It moves most business risk onto the company. Good contracts, clear app terms and insurance are the other half of protecting yourself.",
                ),
                Lesson(
                    "Pros and cons side by side",
                    """
                    **Limited company — advantages**
                    • Limited liability for business debts and claims
                    • Often less tax once profits are over about £30,000–£50,000, by mixing a small salary with dividends
                    • You can keep profit in the company and pay 19% Corporation Tax on it (on profits up to £50,000) instead of higher-rate income tax
                    • Looks more established to customers, app stores and partners
                    • Your home address can stay off public records by using a registered office service
                    • Google Play **organisation** accounts skip the 12-tester, 14-day closed testing rule that new personal accounts must pass

                    **Limited company — disadvantages**
                    • More admin: annual accounts, confirmation statement, Company Tax Return, payroll
                    • An accountant typically costs £50–£200 a month
                    • Company information (directors' names, accounts) is public on Companies House
                    • The money belongs to the company: you can only take it out as salary, dividends (from profits), expenses or a director's loan
                    • Dividend tax rose in April 2026 (10.75% basic rate), so the tax saving is smaller than it used to be
                    """.trimIndent(),
                    tip = "Use the take-home calculator to compare sole trader and limited company for your expected profit.",
                ),
                Lesson(
                    "When a company makes most sense for app developers",
                    """
                    A company is usually a good fit when:
                    • your apps take payments, handle personal data, or could cause someone a loss if they go wrong
                    • you expect profits of more than about £30,000 a year, or want to reinvest profits
                    • you want to publish on Google Play or the Apple App Store under a business name
                    • you'd rather your home address wasn't shown publicly as a trader address on app store listings

                    Being a sole trader can make more sense while you're testing ideas with small earnings: it's free, quick and simple, and you can **switch to a limited company later** (your accountant can transfer the business and its assets).

                    You can also start as a sole trader and earn up to **£1,000** a year tax-free from trading under the trading allowance.
                    """.trimIndent(),
                ),
            ),
            tasks = listOf(
                Task("structure.read", "I understand the difference between a sole trader and a limited company"),
                Task("structure.liability", "I understand that limited liability doesn't cover personal guarantees, wrongful trading or personal wrongdoing"),
                Task("structure.calc", "I've compared my expected take-home pay as sole trader vs company", "Use the calculator below with a realistic profit estimate for your first year."),
                Task("structure.decide", "I've decided to set up a limited company (or chosen to start as a sole trader for now)"),
            ),
            links = listOf(
                Link("Set up a business: legal structures", "https://www.gov.uk/business-legal-structures", "GOV.UK"),
                Link("Set up as a sole trader", "https://www.gov.uk/set-up-sole-trader", "GOV.UK"),
                Link("Set up a private limited company", "https://www.gov.uk/set-up-limited-company", "GOV.UK"),
                Link("Running a limited company", "https://www.gov.uk/running-a-limited-company", "Director responsibilities"),
                Link("Business Support Helpline", "https://www.gov.uk/business-support-helpline", "Free government advice"),
            ),
            quiz = listOf(
                Question(
                    "Your company signs a 3-year office lease and you sign a personal guarantee. The company closes owing rent. Who can the landlord chase?",
                    listOf("Only the company", "You personally, because of the guarantee", "Nobody — limited liability covers it"),
                    1,
                    "A personal guarantee is a promise from you, not the company, so limited liability doesn't protect you from it.",
                ),
                Question(
                    "Which of these is a real advantage of a limited company?",
                    listOf("You never pay any tax on profits", "Business debts normally stay with the company", "You don't have to keep any records"),
                    1,
                    "The company is a separate legal person, so its debts are normally its own. It still pays tax and must keep records.",
                ),
                Question(
                    "Is insurance still worth having once you're a limited company?",
                    listOf("No, the company protects you", "Yes — it pays claims so the company can survive them", "Only if you have employees"),
                    1,
                    "Limited liability stops a claim reaching your personal assets, but a big claim could still sink the company. Insurance covers that.",
                ),
            ),
            tools = listOf(Tool.TAKE_HOME),
        ),

        Step(
            id = "plan",
            title = "Plan your company",
            summary = "Choose a name, your registered office and email, directors, shares, people with significant control and SIC codes.",
            minutes = 15,
            icon = "📝",
            lessons = listOf(
                Lesson(
                    "Choosing a company name",
                    """
                    Your name must end in **Limited** or **Ltd**. It can't be the same as an existing company, or too like one ("ABC Apps Ltd" vs "A.B.C. Apps Limited" counts as the same).

                    **Check three things before you commit:**
                    • **Companies House search** — is the name free?
                    • **UK trade mark search** — is someone else's brand already registered for software (classes 9 and 42)? Using it could get you sued, even with a registered company name.
                    • **Domain and app store** — can you get the .co.uk / .com domain and is the name free on Google Play?

                    Some words are **sensitive** and need permission (for example "Bank", "Royal", "Chartered", "Institute", "Authority"), and offensive names aren't allowed.

                    You can **trade under a different name** from your company name (for example "Pixel Forge" as a trading name of "Smith Digital Ltd"), as long as your company name appears on invoices, your website and app store listing.
                    """.trimIndent(),
                    tip = "If your app or studio name matters to you, consider registering it as a UK trade mark (from £170 online for one class). A company name alone doesn't stop others using it as a brand.",
                ),
                Lesson(
                    "Registered office address and registered email",
                    """
                    Every company needs a **registered office** in the same UK nation where it's registered (England & Wales, Scotland, or Northern Ireland). Official post goes there and **the address is public**.

                    Since March 2024 it must be an **appropriate address**: somewhere official letters will reach someone and can be acknowledged. A PO Box on its own isn't allowed.

                    **Options:**
                    • your home address — free, but it will be public forever on the register
                    • your accountant's address — many offer this
                    • a **registered office service** — around £20–£100 a year

                    You must also give a **registered email address**. It isn't public; Companies House uses it to contact the company.

                    **Directors' home addresses** are not shown publicly: you give a "service address" for the public record (this can be the registered office) and your home address privately.
                    """.trimIndent(),
                ),
                Lesson(
                    "Directors, shareholders and shares",
                    """
                    **Directors** run the company and have legal duties (see below). You need at least one director who is a person, aged 16 or over. A company secretary is optional for private companies.

                    **Shareholders** own the company. You can be the sole director and sole shareholder.

                    **Shares:** most one-person companies issue **1 to 100 ordinary shares at £1 each**. The total is the most you could ever lose as a shareholder. Issuing 100 shares rather than 1 makes it easier to give someone a percentage later (for example, 10 shares = 10%).

                    **Your main legal duties as a director** (Companies Act 2006, sections 171–177):
                    • act within the company's constitution
                    • promote the success of the company
                    • use independent judgement
                    • use reasonable care, skill and diligence
                    • avoid conflicts of interest
                    • don't accept benefits from third parties
                    • declare an interest in any proposed transaction

                    You must also keep company records and file accounts and returns on time.
                    """.trimIndent(),
                ),
                Lesson(
                    "People with significant control (PSC)",
                    """
                    A **PSC** is anyone who owns more than 25% of the shares or votes, can appoint or remove most directors, or otherwise has significant influence. If you own your company outright, **you are its PSC**.

                    PSC details (name, month and year of birth, nationality, service address, the nature of control) are **public**. Your full date of birth and home address are kept private.
                    """.trimIndent(),
                ),
                Lesson(
                    "Identity verification (required since November 2025)",
                    """
                    Everyone setting up a company as a **director or PSC** must now **verify their identity** with Companies House before the company can be registered. You get a **personal code** to use when forming the company.

                    **Two ways to verify:**
                    • **directly with GOV.UK One Login**, using the app with photo ID such as a passport or driving licence (free)
                    • through an **Authorised Corporate Service Provider** (ACSP) such as an accountant or formation agent

                    It usually only takes a few minutes. Do it before you start the registration.
                    """.trimIndent(),
                ),
                Lesson(
                    "SIC codes: what your company does",
                    """
                    You'll pick up to four **SIC codes** that describe your business. Common choices for app developers:
                    • **62012** — Business and domestic software development
                    • **62011** — Ready-made interactive leisure and entertainment software development (games)
                    • **58290** — Other software publishing
                    • **58210** — Publishing of computer games
                    • **62020** — Information technology consultancy activities

                    You can change them later in your confirmation statement.
                    """.trimIndent(),
                ),
                Lesson(
                    "Articles of association and the lawful purpose statement",
                    """
                    **Articles of association** are the company's rule book. Almost all one-person companies use the free **model articles**, which you choose with one click when registering.

                    The **memorandum of association** is a short statement that the founders want to form the company. Companies House generates it for you online.

                    You'll also confirm the company is being formed for a **lawful purpose**, and that subscribers are entitled to act as directors.
                    """.trimIndent(),
                ),
            ),
            tasks = listOf(
                Task("plan.name", "Chosen a company name and checked it's free on Companies House",
                    link = Link("Search the company register", "https://find-and-update.company-information.service.gov.uk/")),
                Task("plan.tm", "Checked the name and app/studio brand against the UK trade mark register",
                    link = Link("Search for a trade mark", "https://www.gov.uk/search-for-trademark")),
                Task("plan.domain", "Checked the domain name and Google Play name are available"),
                Task("plan.office", "Decided on a registered office address (home, accountant or registered office service)"),
                Task("plan.email", "Set up a registered email address for Companies House (for example admin@yourdomain.co.uk)"),
                Task("plan.shares", "Decided on shares (for example 100 ordinary shares of £1) and who owns them"),
                Task("plan.sic", "Chosen SIC codes (for example 62012 for software development)",
                    link = Link("Browse SIC codes", "https://resources.companieshouse.gov.uk/sic/")),
                Task("plan.idv", "Verified my identity with Companies House and saved my personal code",
                    link = Link("Verify your identity for Companies House", "https://www.gov.uk/guidance/verify-your-identity-for-companies-house")),
            ),
            links = listOf(
                Link("Choose a company name", "https://www.gov.uk/limited-company-formation/choose-company-name", "GOV.UK"),
                Link("Incorporation and names guidance", "https://www.gov.uk/government/publications/incorporation-and-names/incorporation-and-names", "Companies House"),
                Link("Registered office address", "https://www.gov.uk/limited-company-formation/company-address", "GOV.UK"),
                Link("Directors and company secretaries", "https://www.gov.uk/limited-company-formation/appoint-directors-and-company-secretaries", "GOV.UK"),
                Link("People with significant control guidance", "https://www.gov.uk/government/publications/guidance-to-the-people-with-significant-control-requirements-for-companies-and-limited-liability-partnerships", "GOV.UK"),
                Link("Memorandum and articles of association", "https://www.gov.uk/limited-company-formation/documents", "GOV.UK"),
                Link("Register a trade mark", "https://www.gov.uk/how-to-register-a-trade-mark", "Intellectual Property Office"),
                Link("Directors' duties (Companies Act 2006, s.171–177)", "https://www.legislation.gov.uk/ukpga/2006/46/part/10/chapter/2", "legislation.gov.uk"),
            ),
            quiz = listOf(
                Question(
                    "You register \"Pixel Forge Ltd\" with Companies House. Does that stop another business using \"Pixel Forge\" as its app brand?",
                    listOf("Yes, the company name protects the brand", "Not necessarily — a trade mark protects a brand", "Only within your city"),
                    1,
                    "A company name only stops an identical company name being registered. To protect a brand, register a trade mark.",
                ),
                Question(
                    "Which of these is visible to the public on the Companies House register?",
                    listOf("Your registered office address", "Your registered email address", "Your full date of birth"),
                    0,
                    "The registered office is public. Your registered email, home address and full date of birth are kept private.",
                ),
                Question(
                    "What must a new director do before the company can be registered?",
                    listOf("Open a business bank account", "Verify their identity with Companies House", "Register for VAT"),
                    1,
                    "Since 18 November 2025 directors and PSCs must verify their identity and use their personal code when the company is formed.",
                ),
            ),
        ),

        Step(
            id = "register",
            title = "Register with Companies House",
            summary = "Incorporate your company online, step by step, and know what you'll receive and what to set up straight after.",
            minutes = 10,
            icon = "🏛️",
            lessons = listOf(
                Lesson(
                    "How to register, step by step",
                    """
                    You can register directly with Companies House online or through a formation agent or accountant (often bundled with a registered office or bank account).

                    **Directly with Companies House:**
                    1. Go to "Set up a private limited company" on GOV.UK and sign in with GOV.UK One Login.
                    2. Enter the company name and check it's available.
                    3. Add the registered office address and registered email address.
                    4. Choose SIC codes.
                    5. Add yourself as director and PSC, entering your **identity verification personal code**.
                    6. Set up shares: number, class (ordinary) and value, and who holds them.
                    7. Choose the model articles.
                    8. Confirm the lawful purpose statement and pay the fee.

                    **Fee:** £${Rates.INCORPORATION_FEE.toInt()} online (from 1 February 2026), or £124 by post. Most online registrations are done within 24 hours.

                    Registering online usually also **sets the company up for Corporation Tax** with HMRC, and lets you register for PAYE at the same time if you'll pay yourself a salary.
                    """.trimIndent(),
                ),
                Lesson(
                    "What you get",
                    """
                    • **Certificate of incorporation** showing your company name, **company number** and date of incorporation. Keep it safe — banks and Google will ask for it.
                    • A **Companies House authentication code** for filing online (posted to your registered office).
                    • Within a few weeks, HMRC posts the company's **Unique Taxpayer Reference (UTR)** to the registered office, usually with a letter confirming it's set up for Corporation Tax.

                    Your company now exists, and so does your responsibility to file things on time — even if it doesn't trade yet.
                    """.trimIndent(),
                ),
                Lesson(
                    "Company records you must keep",
                    """
                    Every company must keep **statutory registers** (most small companies keep these on paper or in a simple spreadsheet, or rely on the central register for some):
                    • register of members (shareholders)
                    • register of directors (and directors' residential addresses)
                    • register of people with significant control
                    • register of charges (secured loans), if any

                    And keep **minutes** of directors' and shareholders' decisions, such as approving dividends or accounts. One-line minutes are fine for a one-person company.
                    """.trimIndent(),
                ),
                Lesson(
                    "Show your company details everywhere",
                    """
                    The law requires your **company name** to be displayed at your registered office and anywhere you trade. Your website, emails, invoices, order forms and letters must show:
                    • the full registered company name
                    • company number
                    • registered office address
                    • where it's registered (for example "Registered in England and Wales")

                    This includes your Google Play / App Store developer page and your app's privacy policy and terms.
                    """.trimIndent(),
                    tip = "Add a short footer to your website and email signature: \"Smith Digital Ltd · Registered in England and Wales · Company no. 12345678 · Registered office: …\"",
                ),
            ),
            tasks = listOf(
                Task("register.done", "Registered my company and received the certificate of incorporation",
                    link = Link("Set up a private limited company", "https://www.gov.uk/limited-company-formation/register-your-company")),
                Task("register.save", "Saved the company number, authentication code and certificate somewhere safe"),
                Task("register.profile", "Entered my incorporation date in the app's Deadlines tool", "This lets the app work out every Companies House and HMRC deadline for you."),
                Task("register.registers", "Set up the statutory registers and a minutes book (or spreadsheet)"),
                Task("register.disclose", "Added the company name, number and registered office to my website and email signature"),
                Task("register.utr", "Received the company's UTR from HMRC (arrives by post within a few weeks)"),
            ),
            links = listOf(
                Link("Register your company online", "https://www.gov.uk/limited-company-formation/register-your-company", "GOV.UK"),
                Link("Companies House fees", "https://www.gov.uk/government/publications/companies-house-fees/companies-house-fees", "Current fees"),
                Link("Signs, stationery and promotional material", "https://www.gov.uk/running-a-limited-company/signs-stationery-and-promotional-material", "What to display"),
                Link("Company and accounting records", "https://www.gov.uk/running-a-limited-company/company-and-accounting-records", "GOV.UK"),
                Link("Find and update company information", "https://find-and-update.company-information.service.gov.uk/", "Companies House service"),
            ),
            quiz = listOf(
                Question(
                    "Where should your company number appear?",
                    listOf("Only on your certificate", "On your website, invoices and business emails", "Nowhere — it's private"),
                    1,
                    "Company name, number, registered office and place of registration must appear on your website, invoices and business correspondence.",
                ),
                Question(
                    "What does HMRC send after your company is formed?",
                    listOf("A VAT number", "The company's Unique Taxpayer Reference (UTR)", "A Google Play licence"),
                    1,
                    "HMRC posts the company's UTR to the registered office. You'll need it to register for Corporation Tax.",
                ),
                Question(
                    "Your company hasn't started trading yet. Does it still have filing deadlines?",
                    listOf("No, not until it trades", "Yes — accounts and confirmation statements are still due", "Only if it has a bank account"),
                    1,
                    "Even dormant companies must file accounts and confirmation statements on time.",
                ),
            ),
            tools = listOf(Tool.DEADLINES),
        ),

        Step(
            id = "bank",
            title = "Business bank account and paying yourself",
            summary = "Keep company money separate, and learn the three legal ways to take money out: salary, dividends and director's loans.",
            minutes = 14,
            icon = "🏦",
            lessons = listOf(
                Lesson(
                    "Open a business bank account",
                    """
                    The company's money is **not your money**. You need a bank account in the company's name, and all business income and spending should go through it. Mixing money makes your records unreliable, can weaken your limited liability protection, and makes HMRC enquiries much harder.

                    **What to compare:**
                    • monthly fee and transaction charges (several app-based banks have free tiers)
                    • links to accounting software (Xero, QuickBooks, FreeAgent) — saves hours of bookkeeping
                    • receipt capture and categorising in the app
                    • whether you can get paid in other currencies (Google pays out in GBP if you choose, but other stores and ad networks may pay in USD or EUR)
                    • FSCS protection — check the account is with a UK-authorised bank (some e-money accounts aren't covered)

                    **Common options:** app-based banks such as Starling, Tide, Monzo Business, Mettle and Countingup, and high-street banks such as Barclays, HSBC, Lloyds, NatWest and Santander.

                    You'll need your certificate of incorporation, company number, ID and proof of address.
                    """.trimIndent(),
                    tip = "Some banks include free accounting software (for example FreeAgent with NatWest, RBS, Ulster and Mettle). That can save £150–£400 a year.",
                ),
                Lesson(
                    "Taking money out: the three legal ways",
                    """
                    **1. Salary** — paid through PAYE payroll (Step 5). It's a business expense, so it reduces Corporation Tax.

                    **2. Dividends** — paid to shareholders out of **profits after Corporation Tax**. They aren't an expense for the company, but are taxed at lower rates for you, and there's no National Insurance on them.

                    **3. Director's loan** — the company lends you money, or repays money you lent it. It must be recorded and repaid (see below).

                    Paying back expenses you paid for personally isn't income at all — that's just the company repaying you (Step 8).
                    """.trimIndent(),
                ),
                Lesson(
                    "A typical salary for a one-person company",
                    """
                    Many sole directors pay themselves a **small salary** and take the rest as dividends. For ${Rates.TAX_YEAR}:

                    • **£${"%,d".format(java.util.Locale.UK, Rates.LOWER_EARNINGS_LIMIT.toInt())} a year** (the Lower Earnings Limit) — the minimum to earn a qualifying year for your **State Pension**, with no tax or National Insurance for you.
                    • **£${"%,d".format(java.util.Locale.UK, Rates.SECONDARY_THRESHOLD.toInt())} a year** is the point where the company starts paying 15% employer National Insurance.
                    • **£${"%,d".format(java.util.Locale.UK, Rates.PERSONAL_ALLOWANCE.toInt())} a year** uses your full personal allowance. The company pays employer NI on the slice above £5,000, but salary is tax-deductible, so this is often still worthwhile.

                    **Employment Allowance** (up to £10,500 off employer NI) **isn't available** if the director is the company's only employee paid above the secondary threshold.

                    The best salary depends on your other income and profits — use the calculator, and ask your accountant.
                    """.trimIndent(),
                ),
                Lesson(
                    "Paying dividends properly",
                    """
                    Dividends can only be paid from **distributable profits** — profits after Corporation Tax, including profits kept from earlier years. Paying more than that is an **illegal dividend**, which you may have to repay.

                    **Each time you pay a dividend:**
                    1. Check the company has enough profit after setting aside Corporation Tax.
                    2. Hold a short **board meeting** (just you) and write **minutes** declaring the dividend.
                    3. Create a **dividend voucher** for each shareholder: company name, date, shareholder name, number of shares, amount.
                    4. Transfer the money from the company account.

                    **Your tax on dividends (${Rates.TAX_YEAR}):** first £500 tax-free, then 10.75% (basic rate), 35.75% (higher rate) or 39.35% (additional rate). If they total over £10,000 in a tax year, you must file a Self Assessment return.
                    """.trimIndent(),
                    warning = "Keep enough money in the company for its Corporation Tax bill (19%–25% of profit) and any VAT owed before you take dividends.",
                ),
                Lesson(
                    "Director's loan account",
                    """
                    Your **director's loan account** tracks money between you and the company that isn't salary, dividends or expenses repaid.

                    • If **you lend the company money** (for example to buy a laptop before the bank account opens), the company owes you. It can repay you any time, tax-free.
                    • If **the company lends you money**, you owe it. If it's still owed 9 months after the company's year end, the company pays a temporary tax (section 455) at the dividend upper rate, refunded when you repay. Loans over £10,000 can also be a taxable benefit.

                    The app tracks your director's loan balance automatically when you mark expenses as "paid personally".
                    """.trimIndent(),
                ),
            ),
            tasks = listOf(
                Task("bank.compare", "Compared business bank accounts (fees, software links, FSCS protection)",
                    link = Link("MoneySavingExpert bank account guides", "https://www.moneysavingexpert.com/bank-accounts/")),
                Task("bank.open", "Opened a bank account in the company's name"),
                Task("bank.separate", "Committed to running all business money through the company account only"),
                Task("bank.salary", "Decided my salary level for this tax year (for example £6,708 or £12,570)"),
                Task("bank.dividends", "Understood how to declare dividends with minutes and vouchers, only from profits after tax"),
                Task("bank.loan", "Recorded any money I've lent the company in the app's records (Director loan in)"),
            ),
            links = listOf(
                Link("Taking money out of a limited company", "https://www.gov.uk/running-a-limited-company/taking-money-out-of-a-limited-company", "GOV.UK"),
                Link("Tax on dividends", "https://www.gov.uk/tax-on-dividends", "Rates and allowance"),
                Link("Directors' loans", "https://www.gov.uk/directors-loans", "GOV.UK"),
                Link("Rates and thresholds for employers 2026 to 2027", "https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2026-to-2027", "GOV.UK"),
                Link("Check your State Pension forecast", "https://www.gov.uk/check-state-pension", "GOV.UK"),
                Link("FSCS: is my money protected?", "https://www.fscs.org.uk/check/check-your-money-is-protected/", "FSCS"),
            ),
            quiz = listOf(
                Question(
                    "Your company made £20,000 profit and owes £3,800 Corporation Tax. What's the most it can pay in dividends from this year?",
                    listOf("£20,000", "£16,200", "£23,800"),
                    1,
                    "Dividends come from profit after Corporation Tax: £20,000 − £3,800 = £16,200 (plus any profits kept from earlier years).",
                ),
                Question(
                    "What paperwork should you create when paying a dividend?",
                    listOf("Board minutes and a dividend voucher", "A payslip", "Nothing — just transfer the money"),
                    0,
                    "Record the decision in board minutes and give each shareholder a dividend voucher.",
                ),
                Question(
                    "Why do many sole directors pay themselves at least the Lower Earnings Limit?",
                    listOf("It's the legal minimum wage for directors", "It builds a qualifying year for the State Pension", "It avoids Corporation Tax entirely"),
                    1,
                    "A salary at or above the Lower Earnings Limit counts towards your State Pension without costing you any tax or NI.",
                ),
            ),
            tools = listOf(Tool.TAKE_HOME, Tool.RECORDS),
        ),
    )
}
