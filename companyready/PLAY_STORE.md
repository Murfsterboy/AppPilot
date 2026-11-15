# Publishing Company Ready UK on Google Play

## 1. Make it yours
- **Application ID:** change `applicationId` (and ideally `namespace`) in `companyready/build.gradle.kts`
  to one based on your own domain, e.g. `uk.co.yourcompany.companyready`. It can never change after
  the first upload.
- **Version:** bump `versionCode` (must increase every upload) and `versionName`.
- **Target SDK:** Google Play requires a recent target API level (currently 36 here). Check the
  requirement each year.

## 2. Create a private upload key (once)
The bundled `companyready.keystore` is only for test builds. Create your own and keep it safe
(back it up; never commit it):

```
keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

Build a signed bundle with it:

```
CR_UPLOAD_STORE_FILE=/path/to/upload.jks CR_UPLOAD_STORE_PASSWORD=... \
CR_UPLOAD_KEY_ALIAS=upload CR_UPLOAD_KEY_PASSWORD=... \
./gradlew :companyready:bundleRelease
# -> companyready/build/outputs/bundle/release/companyready-release.aab
```

Turn on **Play App Signing** when you create the app (Google holds the app signing key; you keep the upload key).

## 3. Play Console answers
- **Category:** Business (or Finance → choose Business, as it's guidance, not a financial service).
- **Data safety:** the app collects and shares **no data**. Everything is stored on the device;
  there is no internet permission, analytics or ads.
- **Privacy policy URL:** required anyway. A short page saying "Company Ready UK stores all
  information on your device only. We do not collect, store or share any personal data." with your
  company name, number and contact email.
- **Ads:** No.
- **Content rating:** complete the questionnaire (no violence/user content) → typically "Everyone".
- **Target audience:** 18+ (business users).
- **Financial features declaration:** the app provides general information and personal record-keeping
  only; it doesn't provide financial services, loans, payments or investment advice.
- **Government apps policy:** the app isn't affiliated with GOV.UK, HMRC or Companies House. Keep the
  listing clear about that (see the description below) and don't use government logos.

## 4. Store listing draft

**Short description (80 chars):**
Set up and run a UK limited company step by step: tax, VAT, insurance & records.

**Full description:**
Company Ready UK takes you from "I want to work for myself" to a fully set-up UK limited company, one step at a time.

12 clear steps, each with plain-English lessons, a checklist of real actions, links to official guidance and a quick quiz:
• Sole trader or limited company? What limited liability really protects
• Plan your company: name, registered office, shares, directors, PSCs, identity verification
• Register with Companies House
• Business bank account, salary, dividends and your director's loan account
• Corporation Tax, PAYE and Self Assessment
• VAT: the £90,000 rolling threshold, voluntary registration, Making Tax Digital, app store sales
• Insurance: Professional Indemnity, cyber, Employers' Liability, ICO fee
• Buying things for the business and claiming them back
• Keeping financial records and invoices
• Choosing an accountant and every yearly deadline
• Selling apps on Google Play and other stores as a company
• Your launch checklist

Built-in tools:
• Records: income, expenses, receipts, VAT, director's loan balance, profit and Corporation Tax estimates, CSV export
• Deadlines: every Companies House, HMRC and Self Assessment date for your company, added to your calendar
• Calculators: salary + dividends vs sole trader take-home, VAT threshold checker, VAT and Corporation Tax
• Mileage log and a jargon-busting glossary

Private by design: no account, no ads, no tracking. Everything stays on your phone.

Company Ready UK provides general information based on 2026/27 UK rules. It is not legal, tax or financial advice and is not affiliated with HMRC, Companies House or GOV.UK.

## 5. Screenshots
CI's `companyready-screenshots` artifact (from the emulator smoke test) gives phone screenshots
of the home screen, a step, the quiz, records, deadlines and calculators in light and dark mode.
