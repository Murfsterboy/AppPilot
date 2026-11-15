package com.apppilot.companyready

/** Steps 9–12: records, accountant and the yearly cycle, selling apps legally, and launch. */
object JourneyC {
    val steps = listOf(
        Step(
            id = "records",
            title = "Keeping financial records",
            summary = "What records the law requires, how long to keep them, invoicing rules, and a simple weekly routine using the app.",
            minutes = 12,
            icon = "📒",
            lessons = listOf(
                Lesson(
                    "What you must keep",
                    """
                    **Accounting records** (for HMRC and Companies House):
                    • all money received and spent by the company, with dates and descriptions
                    • **sales invoices** you issue and **receipts/invoices** for everything you buy
                    • bank statements
                    • details of assets the company owns, and debts it owes or is owed
                    • stock (if any), payroll records, dividend vouchers and director's loan movements
                    • VAT records, if registered (digital, under Making Tax Digital)

                    **How long:** keep company records for at least **6 years** from the end of the financial year they relate to (longer if they relate to an asset you still own, or a year HMRC is enquiring into). Digital copies and photos are fine if they're clear and complete.

                    Failing to keep proper records can lead to fines up to £3,000 and, for directors, disqualification.
                    """.trimIndent(),
                ),
                Lesson(
                    "Invoices: what to include",
                    """
                    Every invoice from your company should show:
                    • the word **"Invoice"** and a **unique, sequential invoice number**
                    • your **company name**, registered office address and company number
                    • the customer's name and address
                    • invoice date and the date of the work or supply
                    • a clear description, quantity and price
                    • the total, and payment terms (for example "payment within 30 days")
                    • if VAT registered: your VAT number, VAT rate and VAT amount per item, and the total excluding VAT

                    **Late payers:** for business customers you can claim statutory interest (8% above the Bank of England base rate) and fixed compensation (£40–£100 per invoice) under the late payment law.
                    """.trimIndent(),
                ),
                Lesson(
                    "Bookkeeping software vs this app",
                    """
                    **This app's records** are ideal for getting started: log income, expenses, receipts and mileage, track what the company owes you, watch your VAT threshold and estimate Corporation Tax. You can **export everything to a CSV spreadsheet** for your accountant.

                    **Once you're trading regularly**, most companies move to cloud bookkeeping software that links to the business bank account and submits returns:
                    • **Xero**, **QuickBooks**, **FreeAgent**, **Sage**, **Zoho Books**, **Pandle** (several have free versions or are free with a business bank)
                    • All of these are **Making Tax Digital** compatible and include payroll or add-ons
                    • Ask your accountant which they prefer — many give discounts

                    For app income: Google Play Console and App Store Connect provide **monthly payout and earnings reports**. Download them each month and keep them with your records — they show sales, store fees and tax withheld.
                    """.trimIndent(),
                ),
                Lesson(
                    "A simple routine that keeps you out of trouble",
                    """
                    **Every week (10 minutes):**
                    • add new income and expenses, and photograph receipts
                    • check the bank account matches your records ("reconciling")

                    **Every month:**
                    • download Google Play / App Store payout reports
                    • check the **VAT threshold** on a rolling 12-month basis
                    • run payroll and send the FPS (if paying a salary)
                    • set aside money for Corporation Tax — a simple rule is **20–25% of profit** into a separate savings pot

                    **Every year:**
                    • send records to your accountant soon after the year end
                    • approve and file accounts, CT600 and confirmation statement
                    • file your personal Self Assessment if needed
                    """.trimIndent(),
                    tip = "Open a second \"tax pot\" savings account for the company and move a percentage of every payout into it. Your Corporation Tax and VAT bills will never be a shock.",
                ),
            ),
            tasks = listOf(
                Task("rec.first", "Added my first income or expense in the app's Records"),
                Task("rec.receipts", "Attached a receipt photo to at least one expense"),
                Task("rec.invoice", "Created an invoice template with all the required details and sequential numbering"),
                Task("rec.software", "Chosen bookkeeping software (or decided to use this app until I start trading regularly)"),
                Task("rec.reports", "Know where to download monthly earnings reports from Google Play Console"),
                Task("rec.taxpot", "Opened a tax savings pot and set a percentage to put aside"),
                Task("rec.routine", "Set a weekly reminder to update my records"),
            ),
            links = listOf(
                Link("Company and accounting records", "https://www.gov.uk/running-a-limited-company/company-and-accounting-records", "GOV.UK"),
                Link("Invoicing and taking payment", "https://www.gov.uk/invoicing-and-taking-payment-from-customers", "GOV.UK"),
                Link("Late commercial payments: interest and debt recovery", "https://www.gov.uk/late-commercial-payments-interest-debt-recovery", "GOV.UK"),
                Link("Record keeping for VAT (Notice 700/21)", "https://www.gov.uk/guidance/record-keeping-for-vat-notice-70021", "HMRC"),
                Link("Self-employed business records", "https://www.gov.uk/self-employed-records", "Sole traders"),
            ),
            quiz = listOf(
                Question(
                    "How long should a limited company keep its accounting records?",
                    listOf("1 year", "At least 6 years from the end of the financial year", "Until the accounts are filed"),
                    1,
                    "Keep them for at least 6 years from the end of the financial year (longer in some cases).",
                ),
                Question(
                    "Which must appear on every invoice your company issues?",
                    listOf("Your personal home address", "A unique invoice number and your company name", "Your National Insurance number"),
                    1,
                    "Invoices need a unique sequential number, your company name and details, the customer, date, description and amount.",
                ),
                Question(
                    "What's a sensible way to avoid a Corporation Tax shock?",
                    listOf("Spend all profit before the year end", "Move 20–25% of profits into a separate tax pot as you go", "Take everything out as dividends"),
                    1,
                    "Setting money aside as you earn it means the bill is ready when it's due.",
                ),
            ),
            tools = listOf(Tool.RECORDS),
        ),

        Step(
            id = "accountant",
            title = "Accountant and your yearly deadlines",
            summary = "Do you need an accountant, what it costs, how to choose one, and every filing deadline in a company's year.",
            minutes = 12,
            icon = "📅",
            lessons = listOf(
                Lesson(
                    "Do you need an accountant?",
                    """
                    It isn't a legal requirement — you can file everything yourself. But for a limited company most people use one, because:
                    • annual accounts must follow accounting standards (FRS 105 for micro-entities)
                    • the Company Tax Return (CT600) needs tax computations and capital allowance claims
                    • they'll plan your salary, dividends and pension to minimise tax legally
                    • they handle payroll, VAT returns and your personal Self Assessment
                    • mistakes and missed deadlines bring penalties that can cost more than their fee

                    **Typical cost** for a small one-person company: **£50–£200 a month** (online accountants are often at the lower end), usually including accounts, CT600, confirmation statement, payroll and your Self Assessment. Their fees are tax-deductible.
                    """.trimIndent(),
                ),
                Lesson(
                    "How to choose one",
                    """
                    • **Qualifications:** look for chartered or certified accountants (**ICAEW**, **ACCA**, **ICAS**, **CIMA**) or **AAT** licensed accountants. Tax advisers may be **CIOT/ATT** members. Anyone can call themselves an "accountant", so check membership.
                    • **Experience** with tech, software or app businesses (VAT on digital services and overseas income matters)
                    • **What's included:** accounts, CT600, confirmation statement, payroll, VAT returns, Self Assessment, registered office, tax investigation cover, unlimited advice?
                    • **Software:** do they use Xero, QuickBooks or FreeAgent, and is the licence included?
                    • **Engagement letter:** a written agreement of what they'll do, their fee and your responsibilities
                    • **Professional indemnity insurance** and anti-money-laundering supervision — regulated firms have both

                    Get 2–3 quotes and ask how quickly they respond to questions.
                    """.trimIndent(),
                    warning = "Even with an accountant, you as director remain legally responsible for filing on time and for the accuracy of the accounts and returns.",
                ),
                Lesson(
                    "Your company's yearly cycle",
                    """
                    **Companies House**
                    • **Confirmation statement** — every 12 months, within 14 days after your review date (usually your incorporation anniversary). £${Rates.CONFIRMATION_FEE.toInt()} online. Confirms directors, shareholders, PSCs, SIC codes, registered office and email.
                    • **Annual accounts** — **9 months** after your financial year end. Your **first** accounts are due **21 months** after incorporation.

                    **HMRC**
                    • **Corporation Tax payment** — 9 months and 1 day after the accounting period ends
                    • **Company Tax Return (CT600)** — 12 months after the period ends
                    • **PAYE** — FPS on or before each payday; pay by the 22nd of the next month; P60s by 31 May
                    • **VAT returns** (if registered) — usually quarterly, 1 month and 7 days after each quarter

                    **You personally**
                    • **Self Assessment** — 31 January (file and pay), 31 July (payment on account)

                    The app's **Deadlines** tool works all of these out from your incorporation date and adds them to your calendar.
                    """.trimIndent(),
                ),
                Lesson(
                    "Penalties for missing deadlines",
                    """
                    **Late accounts (private company):** £150 (up to 1 month late), £375 (1–3 months), £750 (3–6 months), £1,500 (over 6 months). **Doubled** if you were late the previous year too.

                    **Late CT600** (returns due from 1 April 2026): **£200** straight away, rising to **£400** if more than 3 months late, then a percentage of the tax owed after 6 and 12 months. Three late returns in a row raise these to £1,000 and £2,000. This applies even if no tax is owed.

                    **Late confirmation statement:** Companies House can strike the company off, and directors can be prosecuted.

                    **Late tax payments:** interest is charged from the due date.
                    """.trimIndent(),
                ),
            ),
            tasks = listOf(
                Task("acc.decide", "Decided whether to use an accountant or do it myself"),
                Task("acc.quotes", "Got 2–3 quotes from qualified accountants experienced with software businesses",
                    link = Link("Find a chartered accountant (ICAEW)", "https://find.icaew.com/")),
                Task("acc.letter", "Signed an engagement letter (if using an accountant)"),
                Task("acc.agent", "Authorised my accountant as agent with HMRC and given them the Companies House authentication code (if using one)"),
                Task("acc.deadlines", "Entered my company details in Deadlines and added the key dates to my calendar"),
                Task("acc.yearend", "Know my financial year end and when my first accounts and CT600 are due"),
            ),
            links = listOf(
                Link("File your company's annual accounts", "https://www.gov.uk/file-your-company-annual-accounts", "Companies House"),
                Link("Accounts for micro-entities and small companies", "https://www.gov.uk/annual-accounts/microentities-small-and-dormant-companies", "GOV.UK"),
                Link("File your confirmation statement", "https://www.gov.uk/file-your-confirmation-statement-with-companies-house", "Companies House"),
                Link("Late filing penalties (accounts)", "https://www.gov.uk/annual-accounts/penalties-for-late-filing", "Companies House"),
                Link("Late filing penalties (Company Tax Return)", "https://www.gov.uk/company-tax-returns/penalties-for-late-filing", "HMRC"),
                Link("Find an ACCA accountant", "https://www.accaglobal.com/gb/en/member/find-an-accountant.html", "ACCA"),
                Link("Find an AAT licensed accountant", "https://www.aat.org.uk/find-an-accountant-or-bookkeeper", "AAT"),
                Link("Chartered Institute of Taxation", "https://www.tax.org.uk/", "Find a Chartered Tax Adviser"),
            ),
            quiz = listOf(
                Question(
                    "Your company was incorporated on 10 March 2026. When are its first accounts due at Companies House?",
                    listOf("10 December 2026", "10 December 2027", "31 March 2027"),
                    1,
                    "First accounts are due 21 months after incorporation: 10 December 2027.",
                ),
                Question(
                    "Your accountant files your accounts late. Who is legally responsible?",
                    listOf("The accountant", "You, as director", "Companies House"),
                    1,
                    "Directors are responsible for filing on time, even when someone files for them.",
                ),
                Question(
                    "How often must a company file a confirmation statement?",
                    listOf("At least once every 12 months", "Every quarter", "Only when something changes"),
                    0,
                    "At least once every 12 months, within 14 days after the review period ends — even if nothing changed.",
                ),
            ),
            tools = listOf(Tool.DEADLINES),
        ),

        Step(
            id = "sell",
            title = "Selling apps on Google Play and other stores",
            summary = "Set up developer accounts as a company, get paid, handle store tax forms, and meet consumer law and privacy rules.",
            minutes = 15,
            icon = "📱",
            lessons = listOf(
                Lesson(
                    "Google Play Console as an organisation",
                    """
                    When you create a Google Play developer account you choose **personal** or **organisation**. As a company, choose **organisation**.

                    **You'll need:**
                    • a **D-U-N-S number** for your company (free from Dun & Bradstreet; can take a few days up to a few weeks)
                    • company name and address exactly as on Companies House
                    • a company website, contact email and phone number (verified)
                    • the one-off **$25 registration fee** (pay with the company card — it's an allowable expense)

                    **Why it's worth it:**
                    • New personal accounts must run a **closed test with at least 12 testers for 14 days** before publishing to production. Organisation accounts don't have to.
                    • If you sell apps or in-app purchases, Google shows a **trader address** on your store listing. With a company, that can be your **registered office** rather than your home.
                    • Your listing shows your company as the developer, which looks more trustworthy.

                    Google is also rolling out **developer verification** for Android apps; organisations verify with their D-U-N-S number and company details.
                    """.trimIndent(),
                ),
                Lesson(
                    "Getting paid by Google",
                    """
                    • Set up a **payments profile** as a business, in the company's name, and add the **company bank account** (not your personal account)
                    • Google pays monthly once your balance passes the payout threshold
                    • **Service fee:** 15% on the first $1 million of earnings each year (enrolment required), and 15% on subscriptions; check the current rates in Play Console
                    • Google handles VAT on sales to consumers in the UK, EU and many other countries
                    • **US tax form:** complete a **W-8BEN-E** (for a company) in the payments profile so US withholding tax can be reduced to 0% under the UK–US tax treaty. Without it, up to 30% can be withheld on US earnings from some sources.

                    **Apple App Store:** enrol as an **organisation** in the Apple Developer Program (£79 a year) — it also needs a D-U-N-S number. Complete the tax forms and banking in App Store Connect.
                    """.trimIndent(),
                ),
                Lesson(
                    "Selling on your own website and other stores",
                    """
                    • **Your own site:** payment providers such as Stripe or PayPal pay you directly, but **you** are responsible for VAT (UK and overseas), consumer law and receipts.
                    • **Merchant of record** services (Paddle, Lemon Squeezy, FastSpring) sell on your behalf and handle global sales tax and VAT, in return for a higher fee — often the simplest choice for selling desktop apps or licences internationally.
                    • **Other app stores** (Amazon Appstore, Samsung Galaxy Store, Huawei AppGallery, Steam for games) each have their own developer agreement, payout and tax forms.

                    Keep a list of every platform, its payout currency and which records it provides each month.
                    """.trimIndent(),
                ),
                Lesson(
                    "Consumer law, privacy and app policies",
                    """
                    **Consumer law (UK):**
                    • under the **Consumer Rights Act 2015**, digital content must be of satisfactory quality, fit for purpose and as described; customers are entitled to a repair or replacement, or a price reduction, if it isn't
                    • consumers usually have a **14-day cancellation right** for online purchases. For digital content it ends once the download starts, but only if the customer gave express consent and acknowledged losing the right
                    • subscriptions must be clear about price, renewal and how to cancel; new UK subscription rules are being introduced under the Digital Markets, Competition and Consumers Act 2024

                    **Privacy:** a privacy policy (link it in Play Console and inside the app), an accurate **Data safety** section, consent for tracking where required, and a way for users to request **account deletion** if your app has accounts (a Google Play requirement).

                    **Google Play policies:** read the Developer Program Policies, especially on payments (use Google Play Billing for digital goods), deceptive behaviour, user data, ads and children's apps (Families policy).
                    """.trimIndent(),
                    tip = "Put your company name, number and registered office in the privacy policy, terms of use and the store listing's contact details — it's a legal requirement and builds trust.",
                ),
            ),
            tasks = listOf(
                Task("sell.duns", "Got a D-U-N-S number for my company",
                    link = Link("Get a D-U-N-S number", "https://www.dnb.com/duns/get-a-duns.html")),
                Task("sell.play", "Created a Google Play Console organisation account in the company's name",
                    link = Link("Google Play Console sign-up", "https://play.google.com/console/signup")),
                Task("sell.payments", "Set up the payments profile with the company bank account"),
                Task("sell.w8", "Completed the W-8BEN-E tax form for the company"),
                Task("sell.policy", "Published a privacy policy and completed the Data safety form"),
                Task("sell.terms", "Written app terms and refund/cancellation wording that follow UK consumer law"),
                Task("sell.listing", "Added company name and registered office details to the store listing and website"),
                Task("sell.other", "Decided which other stores or direct-sales channels to use (Apple, own site, merchant of record)"),
            ),
            links = listOf(
                Link("Google Play Console", "https://play.google.com/console/signup", "Create a developer account"),
                Link("Play Console Help", "https://support.google.com/googleplay/android-developer/", "Accounts, payments, policies"),
                Link("Developer Program Policies", "https://play.google.com/about/developer-content-policy/", "Google Play"),
                Link("D-U-N-S number", "https://www.dnb.com/duns/get-a-duns.html", "Dun & Bradstreet"),
                Link("Apple Developer Program enrolment", "https://developer.apple.com/programs/enroll/", "Apple"),
                Link("Apple: D-U-N-S number lookup", "https://developer.apple.com/support/D-U-N-S/", "Apple"),
                Link("Consumer Rights Act guidance (Business Companion)", "https://www.businesscompanion.info/", "Trading Standards"),
                Link("UK GDPR: guide for small organisations", "https://ico.org.uk/for-organisations/advice-for-small-organisations/", "ICO"),
            ),
            quiz = listOf(
                Question(
                    "What do you need to create a Google Play organisation account?",
                    listOf("A D-U-N-S number for your company", "A VAT number", "An accountant's signature"),
                    0,
                    "Google uses the D-U-N-S number to verify organisations. It's free from Dun & Bradstreet.",
                ),
                Question(
                    "Which tax form should your company complete in Google Play's payments profile?",
                    listOf("P60", "W-8BEN-E", "CT600"),
                    1,
                    "The W-8BEN-E lets your company claim UK–US tax treaty benefits so US withholding can be reduced.",
                ),
                Question(
                    "A customer buys your app and starts downloading straight away. When can they lose their 14-day right to cancel?",
                    listOf("Never", "Only if they expressly agreed to immediate supply and acknowledged losing the right", "Always, automatically"),
                    1,
                    "The right ends when supply begins only if the consumer gave express consent and acknowledged losing it. Google Play's checkout handles this for store sales.",
                ),
            ),
        ),

        Step(
            id = "ready",
            title = "You're ready: launch checklist",
            summary = "A final check of everything, and the habits that keep your company healthy and compliant.",
            minutes = 6,
            icon = "🚀",
            lessons = listOf(
                Lesson(
                    "Your launch checklist",
                    """
                    **Company**
                    • Registered at Companies House; certificate, company number and authentication code saved
                    • Name, number and registered office on your website, emails, invoices and store listings
                    • Statutory registers and a minutes book set up

                    **Money**
                    • Business bank account, company card and tax savings pot
                    • Salary decided; payroll running if you pay one; dividends only with minutes and vouchers

                    **Tax**
                    • Corporation Tax registered; PAYE registered (if paying a salary)
                    • VAT position decided and threshold checked monthly
                    • Self Assessment checked for you personally

                    **Protection**
                    • PI and cyber insurance in place (EL if you employ anyone)
                    • ICO fee paid; privacy policy and terms published

                    **Records and deadlines**
                    • Recording income and expenses weekly, with receipts
                    • Accountant chosen (or a plan to file yourself)
                    • All deadlines in your calendar

                    **Selling**
                    • Google Play organisation account, payments profile and tax forms done
                    """.trimIndent(),
                ),
                Lesson(
                    "Habits of a healthy company",
                    """
                    • **Never** treat the company account as your own wallet — record every withdrawal as salary, dividend, expense or loan
                    • Check deadlines at the start of every month
                    • Keep 20–25% of profit aside for tax
                    • Review insurance cover every year as you grow
                    • Revisit your salary and dividend plan each April when tax rates change
                    • Update Companies House within 14 days if directors, addresses or shareholders change
                    • Ask your accountant **before** big decisions: hiring, buying a car, taking investment, selling overseas

                    **Rates change every year.** This app shows ${Rates.TAX_YEAR} figures; always check the links for the latest.
                    """.trimIndent(),
                    tip = "Come back to the Records, Deadlines and Calculators tools whenever you need them — they're designed for everyday use after you launch.",
                ),
            ),
            tasks = listOf(
                Task("ready.company", "Company registered and details displayed everywhere"),
                Task("ready.money", "Bank account, tax pot and plan for paying myself in place"),
                Task("ready.tax", "All HMRC registrations done and VAT position decided"),
                Task("ready.protect", "Insurance, ICO and legal documents in place"),
                Task("ready.records", "Records up to date and deadlines in my calendar"),
                Task("ready.sell", "Developer accounts set up as a company and ready to publish"),
            ),
            links = listOf(
                Link("Running a limited company", "https://www.gov.uk/running-a-limited-company", "GOV.UK"),
                Link("Make changes to your company", "https://www.gov.uk/file-changes-to-a-company-with-companies-house", "Companies House"),
                Link("Business support helpline", "https://www.gov.uk/business-support-helpline", "Free government advice"),
                Link("Start Up Loans", "https://www.startuploans.co.uk/", "Government-backed loans and mentoring"),
                Link("Income Tax rates", "https://www.gov.uk/income-tax-rates", "Check each April"),
            ),
            quiz = listOf(
                Question(
                    "You change your registered office address. How long do you have to tell Companies House?",
                    listOf("14 days", "6 months", "Only at the next confirmation statement"),
                    0,
                    "Changes to directors, PSCs and the registered office should be filed within 14 days.",
                ),
                Question(
                    "You need £500 for a personal holiday and the company has the cash. What's the right way to take it?",
                    listOf("Just transfer it and forget about it",
                        "Declare a dividend from profits (with minutes and a voucher), or record it as a director's loan",
                        "Record it as a business travel expense"),
                    1,
                    "Every withdrawal must be salary, a properly declared dividend, a director's loan, or repaying genuine expenses.",
                ),
                Question(
                    "Tax rates and thresholds…",
                    listOf("Never change", "Can change every tax year — check each April", "Only change when you register for VAT"),
                    1,
                    "Rates and thresholds are set each year and can change at any Budget. This app shows ${Rates.TAX_YEAR} figures.",
                ),
            ),
            tools = listOf(Tool.RECORDS, Tool.DEADLINES),
        ),
    )
}
