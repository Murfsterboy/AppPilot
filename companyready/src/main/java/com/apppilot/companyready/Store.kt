package com.apppilot.companyready

import android.content.ContentValues
import android.content.Context
import android.content.SharedPreferences
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import java.time.LocalDate

/** Journey progress and company profile, kept in SharedPreferences. */
class Progress(context: Context) {
    private val p: SharedPreferences = context.getSharedPreferences("progress", Context.MODE_PRIVATE)

    var acceptedDisclaimer: Boolean
        get() = p.getBoolean("disclaimer", false)
        set(v) = p.edit().putBoolean("disclaimer", v).apply()

    fun isDone(taskId: String) = p.getBoolean("task.$taskId", false)
    fun setDone(taskId: String, done: Boolean) = p.edit().putBoolean("task.$taskId", done).apply()

    fun quizPassed(stepId: String) = p.getBoolean("quiz.$stepId", false)
    fun setQuizPassed(stepId: String) = p.edit().putBoolean("quiz.$stepId", true).apply()

    fun lessonsRead(stepId: String) = p.getBoolean("read.$stepId", false)
    fun setLessonsRead(stepId: String) = p.edit().putBoolean("read.$stepId", true).apply()

    fun tasksDone(step: Step) = step.tasks.count { isDone(it.id) }

    /** 0..1 for a step: each task counts once, the quiz counts as one more item. */
    fun stepFraction(step: Step): Float {
        val total = step.tasks.size + 1
        val done = tasksDone(step) + if (quizPassed(step.id)) 1 else 0
        return done.toFloat() / total
    }

    fun stepComplete(step: Step) = stepFraction(step) >= 1f

    fun overallFraction(): Float {
        val steps = Journey.steps
        val total = steps.sumOf { it.tasks.size + 1 }
        val done = steps.sumOf { tasksDone(it) + if (quizPassed(it.id)) 1 else 0 }
        return done.toFloat() / total
    }

    /** The first step that isn't complete, or null when everything is done. */
    fun nextStep(): Step? = Journey.steps.firstOrNull { !stepComplete(it) }

    fun resetAll() = p.edit().clear().putBoolean("disclaimer", true).apply()

    // ----- company profile (for deadlines and calculators) -----
    var companyName: String
        get() = p.getString("co.name", "") ?: ""
        set(v) = p.edit().putString("co.name", v).apply()

    var incorporated: LocalDate?
        get() = p.getLong("co.inc", Long.MIN_VALUE).let { if (it == Long.MIN_VALUE) null else LocalDate.ofEpochDay(it) }
        set(v) = p.edit().putLong("co.inc", v?.toEpochDay() ?: Long.MIN_VALUE).apply()

    var yearEndMonth: Int?
        get() = p.getInt("co.yem", 0).let { if (it == 0) null else it }
        set(v) = p.edit().putInt("co.yem", v ?: 0).apply()

    var vatRegistered: Boolean
        get() = p.getBoolean("co.vat", false)
        set(v) = p.edit().putBoolean("co.vat", v).apply()

    var vatStagger: Int
        get() = p.getInt("co.vatStagger", 1)
        set(v) = p.edit().putInt("co.vatStagger", v).apply()

    var runsPayroll: Boolean
        get() = p.getBoolean("co.payroll", false)
        set(v) = p.edit().putBoolean("co.payroll", v).apply()

    var selfAssessment: Boolean
        get() = p.getBoolean("co.sa", true)
        set(v) = p.edit().putBoolean("co.sa", v).apply()

    var icoPaid: LocalDate?
        get() = p.getLong("co.ico", Long.MIN_VALUE).let { if (it == Long.MIN_VALUE) null else LocalDate.ofEpochDay(it) }
        set(v) = p.edit().putLong("co.ico", v?.toEpochDay() ?: Long.MIN_VALUE).apply()

    fun profile() = CompanyProfile(incorporated, yearEndMonth, vatRegistered, vatStagger, runsPayroll, selfAssessment, icoPaid)
}

/** How a category affects the numbers. */
enum class Role { INCOME, EXPENSE, NOT_ALLOWABLE, CAPITAL, LOAN_IN, LOAN_OUT, DIVIDEND, TAX_PAID }

data class Category(
    val key: String,
    val name: String,
    val role: Role,
    val hint: String,
    /** For income: whether it normally counts towards UK VAT taxable turnover. */
    val vatTurnoverDefault: Boolean = true,
)

object Categories {
    val income = listOf(
        Category("in.store", "App store payouts (Google Play, Apple)", Role.INCOME,
            "Payouts from app stores. Usually a supply to the store (outside the UK), so it often doesn't count towards the UK VAT threshold — check with your accountant.",
            vatTurnoverDefault = false),
        Category("in.ads", "Advertising revenue (AdMob etc.)", Role.INCOME,
            "Ad network payouts. If the network is based outside the UK, it usually doesn't count towards UK VAT turnover.",
            vatTurnoverDefault = false),
        Category("in.direct", "Direct sales (own website, Stripe, PayPal)", Role.INCOME,
            "Sales you make yourself. These count towards UK VAT turnover for UK customers."),
        Category("in.services", "Development / consulting work", Role.INCOME,
            "Freelance or contract work for clients. Counts towards VAT turnover for UK clients."),
        Category("in.other", "Other income", Role.INCOME, "Grants, refunds, other business income."),
        Category("in.interest", "Bank interest", Role.INCOME, "Interest is VAT-exempt, so it doesn't count towards the threshold.",
            vatTurnoverDefault = false),
        Category("in.loan", "Director loan: money I put in", Role.LOAN_IN,
            "Money you lend the company from your own pocket. Not income — the company owes it back to you, tax-free."),
    )

    val expense = listOf(
        Category("ex.equipment", "Equipment & computers", Role.CAPITAL,
            "Laptops, phones, test devices, monitors. Usually 100% deductible through the Annual Investment Allowance."),
        Category("ex.software", "Software & subscriptions", Role.EXPENSE, "IDEs, design tools, AI tools, SaaS, cloud services."),
        Category("ex.devaccounts", "Developer accounts & store fees", Role.EXPENSE, "Google Play \$25 registration, Apple Developer £79/year."),
        Category("ex.hosting", "Hosting, domains & APIs", Role.EXPENSE, "Servers, Firebase, domain names, email hosting, API usage."),
        Category("ex.phone", "Phone & internet", Role.EXPENSE, "Company mobile contract, or the business share of broadband."),
        Category("ex.home", "Use of home (£6/week)", Role.EXPENSE, "Flat-rate homeworking allowance the company pays you: £6 a week with no receipts needed."),
        Category("ex.travel", "Travel & accommodation", Role.EXPENSE, "Trains, flights, hotels for business trips (not commuting)."),
        Category("ex.mileage", "Mileage paid to me", Role.EXPENSE, "Approved mileage payments (45p/25p a mile). Use the mileage log to calculate."),
        Category("ex.training", "Training, courses & books", Role.EXPENSE, "Courses and books that update your existing skills."),
        Category("ex.professional", "Accountant & legal fees", Role.EXPENSE, "Accountant, solicitor, trade mark attorney."),
        Category("ex.fees", "Companies House, ICO & licence fees", Role.EXPENSE, "Incorporation, confirmation statement, ICO fee, trade mark fees."),
        Category("ex.insurance", "Insurance", Role.EXPENSE, "PI, cyber, public liability, equipment cover."),
        Category("ex.marketing", "Advertising & marketing", Role.EXPENSE, "App store ads, social ads, website, promotional material."),
        Category("ex.contractors", "Freelancers & contractors", Role.EXPENSE, "Designers, testers, translators, other developers."),
        Category("ex.bank", "Bank & payment fees", Role.EXPENSE, "Bank charges, Stripe/PayPal fees, currency conversion."),
        Category("ex.office", "Office supplies & postage", Role.EXPENSE, "Stationery, postage, small items."),
        Category("ex.salary", "Salary & employer NI", Role.EXPENSE, "Gross salary paid through payroll, plus employer National Insurance."),
        Category("ex.pension", "Company pension contributions", Role.EXPENSE, "Employer contributions into your pension — usually deductible."),
        Category("ex.other", "Other allowable expense", Role.EXPENSE, "Any other cost wholly and exclusively for the business."),
        Category("ex.entertainment", "Client entertainment (not deductible)", Role.NOT_ALLOWABLE,
            "Meals or events for clients. Record it, but it isn't deductible for Corporation Tax and VAT can't be reclaimed."),
        Category("ex.personal", "Personal / not allowable", Role.NOT_ALLOWABLE,
            "Fines, personal items, anything not wholly for the business."),
        Category("ex.dividend", "Dividend paid to me", Role.DIVIDEND,
            "Not an expense. Only pay from profits after tax, with board minutes and a dividend voucher."),
        Category("ex.repay", "Repaid to me (director loan)", Role.LOAN_OUT,
            "The company paying you back money you lent it or expenses you paid personally. Tax-free."),
        Category("ex.tax", "Corporation Tax / VAT / PAYE paid to HMRC", Role.TAX_PAID,
            "Tax payments to HMRC. Not an expense for Corporation Tax."),
    )

    val all = income + expense
    fun byKey(key: String) = all.firstOrNull { it.key == key } ?: expense.first { it.key == "ex.other" }
}

data class Entry(
    val id: Long = 0,
    val date: LocalDate,
    val isIncome: Boolean,
    val category: String,
    val description: String,
    val party: String,
    /** Gross amount in pence, including any VAT. */
    val amount: Long,
    /** VAT included in [amount], in pence. */
    val vat: Long,
    val paidPersonally: Boolean,
    val countsForVat: Boolean,
    val receiptUri: String?,
    val notes: String,
) {
    val cat get() = Categories.byKey(category)
}

data class Trip(
    val id: Long = 0,
    val date: LocalDate,
    val from: String,
    val to: String,
    val purpose: String,
    /** Miles x 10, so 12.5 miles = 125. */
    val tenthMiles: Long,
    val claimed: Boolean,
) {
    val miles get() = tenthMiles / 10.0
}

class Ledger(context: Context) : SQLiteOpenHelper(context, "ledger.db", null, 1) {

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """CREATE TABLE entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date INTEGER NOT NULL,
                income INTEGER NOT NULL,
                category TEXT NOT NULL,
                description TEXT NOT NULL,
                party TEXT NOT NULL DEFAULT '',
                amount INTEGER NOT NULL,
                vat INTEGER NOT NULL DEFAULT 0,
                personal INTEGER NOT NULL DEFAULT 0,
                vat_turnover INTEGER NOT NULL DEFAULT 1,
                receipt TEXT,
                notes TEXT NOT NULL DEFAULT ''
            )"""
        )
        db.execSQL("CREATE INDEX entries_date ON entries(date)")
        db.execSQL(
            """CREATE TABLE trips (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date INTEGER NOT NULL,
                origin TEXT NOT NULL,
                destination TEXT NOT NULL,
                purpose TEXT NOT NULL,
                tenth_miles INTEGER NOT NULL,
                claimed INTEGER NOT NULL DEFAULT 0
            )"""
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {}

    // ----- entries -----

    fun save(e: Entry): Long {
        val v = ContentValues().apply {
            put("date", e.date.toEpochDay())
            put("income", if (e.isIncome) 1 else 0)
            put("category", e.category)
            put("description", e.description)
            put("party", e.party)
            put("amount", e.amount)
            put("vat", e.vat)
            put("personal", if (e.paidPersonally) 1 else 0)
            put("vat_turnover", if (e.countsForVat) 1 else 0)
            put("receipt", e.receiptUri)
            put("notes", e.notes)
        }
        return if (e.id == 0L) writableDatabase.insert("entries", null, v)
        else { writableDatabase.update("entries", v, "id=?", arrayOf(e.id.toString())); e.id }
    }

    fun delete(id: Long) = writableDatabase.delete("entries", "id=?", arrayOf(id.toString()))

    fun entry(id: Long): Entry? =
        readableDatabase.rawQuery("SELECT * FROM entries WHERE id=?", arrayOf(id.toString())).use { c ->
            if (c.moveToFirst()) readEntry(c) else null
        }

    fun entries(from: LocalDate? = null, to: LocalDate? = null): List<Entry> {
        val where = mutableListOf<String>()
        val args = mutableListOf<String>()
        if (from != null) { where += "date >= ?"; args += from.toEpochDay().toString() }
        if (to != null) { where += "date <= ?"; args += to.toEpochDay().toString() }
        val sql = "SELECT * FROM entries" + (if (where.isEmpty()) "" else " WHERE " + where.joinToString(" AND ")) +
            " ORDER BY date DESC, id DESC"
        return readableDatabase.rawQuery(sql, args.toTypedArray()).use { c ->
            val out = mutableListOf<Entry>()
            while (c.moveToNext()) out += readEntry(c)
            out
        }
    }

    private fun readEntry(c: Cursor) = Entry(
        id = c.getLong(c.getColumnIndexOrThrow("id")),
        date = LocalDate.ofEpochDay(c.getLong(c.getColumnIndexOrThrow("date"))),
        isIncome = c.getInt(c.getColumnIndexOrThrow("income")) == 1,
        category = c.getString(c.getColumnIndexOrThrow("category")),
        description = c.getString(c.getColumnIndexOrThrow("description")),
        party = c.getString(c.getColumnIndexOrThrow("party")),
        amount = c.getLong(c.getColumnIndexOrThrow("amount")),
        vat = c.getLong(c.getColumnIndexOrThrow("vat")),
        paidPersonally = c.getInt(c.getColumnIndexOrThrow("personal")) == 1,
        countsForVat = c.getInt(c.getColumnIndexOrThrow("vat_turnover")) == 1,
        receiptUri = c.getString(c.getColumnIndexOrThrow("receipt")),
        notes = c.getString(c.getColumnIndexOrThrow("notes")),
    )

    // ----- trips -----

    fun save(t: Trip): Long {
        val v = ContentValues().apply {
            put("date", t.date.toEpochDay())
            put("origin", t.from)
            put("destination", t.to)
            put("purpose", t.purpose)
            put("tenth_miles", t.tenthMiles)
            put("claimed", if (t.claimed) 1 else 0)
        }
        return if (t.id == 0L) writableDatabase.insert("trips", null, v)
        else { writableDatabase.update("trips", v, "id=?", arrayOf(t.id.toString())); t.id }
    }

    fun deleteTrip(id: Long) = writableDatabase.delete("trips", "id=?", arrayOf(id.toString()))

    fun trips(): List<Trip> =
        readableDatabase.rawQuery("SELECT * FROM trips ORDER BY date DESC, id DESC", null).use { c ->
            val out = mutableListOf<Trip>()
            while (c.moveToNext()) out += Trip(
                id = c.getLong(c.getColumnIndexOrThrow("id")),
                date = LocalDate.ofEpochDay(c.getLong(c.getColumnIndexOrThrow("date"))),
                from = c.getString(c.getColumnIndexOrThrow("origin")),
                to = c.getString(c.getColumnIndexOrThrow("destination")),
                purpose = c.getString(c.getColumnIndexOrThrow("purpose")),
                tenthMiles = c.getLong(c.getColumnIndexOrThrow("tenth_miles")),
                claimed = c.getInt(c.getColumnIndexOrThrow("claimed")) == 1,
            )
            out
        }

    fun clearAll() {
        writableDatabase.delete("entries", null, null)
        writableDatabase.delete("trips", null, null)
    }
}
