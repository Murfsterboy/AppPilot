package com.apppilot.companyready

import android.app.AlertDialog
import android.os.Bundle

class AboutActivity : BaseActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val version = try { packageManager.getPackageInfo(packageName, 0).versionName } catch (e: Exception) { "" }
        setTitles("About & privacy", "Company Ready UK $version")

        val a = card()
        heading("Important", a, 17f)
        body("Company Ready UK gives general information about becoming self-employed and running a private limited company in the UK. It is **not** legal, tax, accounting or financial advice, and it doesn't create any professional relationship.", a)
        body("Tax rates, thresholds and fees shown are for the **${Rates.TAX_YEAR}** tax year and can change at any Budget. Calculators give estimates for simple situations only. Always check the official GOV.UK links and get advice from a qualified accountant or solicitor before acting.", a)
        body("Scotland and Northern Ireland have some different rules (for example Scottish income tax bands, and companies registered in Scotland or Northern Ireland need a registered office there).", a)

        val p = card()
        heading("Your data", p, 17f)
        body("Everything you enter — progress, company details, financial records, mileage and receipt links — is stored **only on this phone**. The app has no account, no analytics, no ads and doesn't use the internet. Links open in your browser.", p)
        body("Receipts stay where they are on your phone; the app only remembers a link to them. Android's own device backup may include the app's data if you've turned backup on.", p)
        body("Use **Export CSV** in Records to send a copy to your accountant.", p)

        val s = card()
        heading("Official sources", s, 17f)
        listOf(
            Link("GOV.UK: Set up a limited company", "https://www.gov.uk/set-up-limited-company"),
            Link("Companies House", "https://www.gov.uk/government/organisations/companies-house"),
            Link("HMRC", "https://www.gov.uk/government/organisations/hm-revenue-customs"),
            Link("Information Commissioner's Office", "https://ico.org.uk/"),
        ).forEach { linkRow(it, s) }

        val r = card()
        heading("Start again", r, 17f)
        small("Clear your journey progress, or erase all financial records and mileage from this phone.", r)
        secondaryButton("Reset journey progress", r) {
            AlertDialog.Builder(this).setMessage("Untick every action and reset all quizzes? Your records are kept.")
                .setPositiveButton("Reset") { _, _ -> Progress(this).resetAll(); toast("Progress reset") }
                .setNegativeButton("Cancel", null).show()
        }
        secondaryButton("Erase all records and mileage", r) {
            AlertDialog.Builder(this).setMessage("Permanently delete all income, expenses and mileage entries from this phone? Export them first if you need a copy.")
                .setPositiveButton("Erase") { _, _ -> Ledger(this).use { it.clearAll() }; toast("Records erased") }
                .setNegativeButton("Cancel", null).show()
        }
    }
}
