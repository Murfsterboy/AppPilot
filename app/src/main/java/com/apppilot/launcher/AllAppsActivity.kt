package com.apppilot.launcher

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.PorterDuff
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.ContactsContract
import android.provider.Settings
import android.text.Editable
import android.text.TextWatcher
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.inputmethod.EditorInfo
import android.widget.BaseAdapter
import android.widget.EditText
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ListView
import android.widget.TextView
import java.util.concurrent.Executors

/**
 * Alphabetical list of every app, with search. Typing also finds contacts (call / message buttons).
 * Long-press an app to pin, hide, or uninstall it.
 */
class AllAppsActivity : Activity() {

    private class Contact(val id: Long, val lookupKey: String, val name: String, val number: String)

    private sealed class Row {
        class App(val app: AppEntry) : Row()
        class Person(val contact: Contact) : Row()
        class Header(val title: String) : Row()
        object AskContacts : Row()
    }

    private lateinit var prefs: Prefs
    private lateinit var repo: AppRepository
    private lateinit var search: EditText
    private val adapter = RowsAdapter()
    private var all: List<AppEntry> = emptyList()
    private var contacts: List<Contact> = emptyList()
    private val contactExecutor = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private var queryGeneration = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = Prefs(this)
        repo = AppRepository(this, prefs)
        window.statusBarColor = prefs.leftBg
        window.navigationBarColor = prefs.leftBg

        val text = prefs.leftText
        search = EditText(this).apply {
            hint = if (prefs.searchContacts) "Search apps and contacts" else "Search apps"
            setTextColor(text)
            setHintTextColor(Colors.withAlpha(text, 0.5f))
            textSize = 18f
            isSingleLine = true
            imeOptions = EditorInfo.IME_ACTION_GO
            background = GradientDrawable().apply {
                cornerRadius = dp(14f)
                setColor(Colors.withAlpha(text, 0.08f))
            }
            setPadding(dpi(16), dpi(12), dpi(16), dpi(12))
            addTextChangedListener(object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
                override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
                override fun afterTextChanged(s: Editable?) = onQueryChanged()
            })
            setOnEditorActionListener { _, actionId, _ ->
                if (actionId == EditorInfo.IME_ACTION_GO) {
                    when (val first = adapter.rows.firstOrNull { it is Row.App || it is Row.Person }) {
                        is Row.App -> launch(first.app)
                        is Row.Person -> openContact(first.contact)
                        else -> {}
                    }
                    true
                } else false
            }
        }

        val list = ListView(this).apply {
            adapter = this@AllAppsActivity.adapter
            divider = null
            isFastScrollEnabled = true
            setOnItemClickListener { _, _, pos, _ -> onRowClick(this@AllAppsActivity.adapter.rows[pos]) }
            setOnItemLongClickListener { _, _, pos, _ ->
                val row = this@AllAppsActivity.adapter.rows[pos]
                if (row is Row.App) {
                    AppActions.showMenu(this@AllAppsActivity, row.app, prefs) {
                        this@AllAppsActivity.adapter.notifyDataSetChanged()
                    }
                    true
                } else false
            }
        }

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            fitsSystemWindows = true
            setBackgroundColor(prefs.leftBg)
            setPadding(dpi(16), dpi(12), dpi(16), 0)
            addView(search, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
            addView(list, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f).apply { topMargin = dpi(8) })
        }
        setContentView(root)

        if (prefs.autoKeyboard) {
            search.requestFocus()
            window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE or
                WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        }

        repo.loadAll { apps ->
            all = apps
            rebuildRows()
        }
    }

    override fun onDestroy() {
        repo.shutdown()
        contactExecutor.shutdownNow()
        super.onDestroy()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQ_CONTACTS) onQueryChanged()
    }

    // ------------------------------------------------------------------ search

    private val query: String get() = search.text.toString().trim()

    private fun hasContactsPermission() =
        checkSelfPermission(Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED

    private fun onQueryChanged() {
        val q = query
        val gen = ++queryGeneration
        if (q.isEmpty() || !prefs.searchContacts || !hasContactsPermission()) {
            contacts = emptyList()
            rebuildRows()
            return
        }
        rebuildRows() // show app matches immediately; contacts follow
        contactExecutor.execute {
            val found = queryContacts(q)
            main.post {
                if (gen == queryGeneration) {
                    contacts = found
                    rebuildRows()
                }
            }
        }
    }

    private fun queryContacts(q: String): List<Contact> {
        val uri = Uri.withAppendedPath(ContactsContract.CommonDataKinds.Phone.CONTENT_FILTER_URI, Uri.encode(q))
        val projection = arrayOf(
            ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
            ContactsContract.CommonDataKinds.Phone.LOOKUP_KEY,
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME_PRIMARY,
            ContactsContract.CommonDataKinds.Phone.NUMBER,
            ContactsContract.CommonDataKinds.Phone.IS_SUPER_PRIMARY
        )
        val out = LinkedHashMap<Long, Contact>()
        try {
            contentResolver.query(uri, projection, null, null,
                "${ContactsContract.CommonDataKinds.Phone.IS_SUPER_PRIMARY} DESC")?.use { c ->
                while (c.moveToNext() && out.size < MAX_CONTACTS) {
                    val id = c.getLong(0)
                    if (id in out) continue // one row per person (their primary number first)
                    out[id] = Contact(id, c.getString(1) ?: "", c.getString(2) ?: "", c.getString(3) ?: "")
                }
            }
        } catch (_: Exception) { }
        return out.values.sortedBy { it.name.lowercase() }
    }

    private fun rebuildRows() {
        val q = query.lowercase()
        val apps = if (q.isEmpty()) all else {
            // Names starting with the query first, then any word starting with it, then containing it.
            val starts = all.filter { it.label.lowercase().startsWith(q) }
            val words = all.filter { a -> a !in starts && a.label.lowercase().split(' ').any { it.startsWith(q) } }
            val contains = all.filter { it !in starts && it !in words && it.label.lowercase().contains(q) }
            starts + words + contains
        }
        val rows = mutableListOf<Row>()
        if (q.isNotEmpty()) {
            if (apps.isNotEmpty()) rows += Row.Header("Apps")
            rows += apps.map { Row.App(it) }
            if (prefs.searchContacts) {
                if (!hasContactsPermission()) rows += Row.AskContacts
                else if (contacts.isNotEmpty()) {
                    rows += Row.Header("Contacts")
                    rows += contacts.map { Row.Person(it) }
                }
            }
        } else {
            rows += apps.map { Row.App(it) }
        }
        adapter.rows = rows
        adapter.notifyDataSetChanged()
    }

    private fun onRowClick(row: Row) {
        when (row) {
            is Row.App -> launch(row.app)
            is Row.Person -> openContact(row.contact)
            Row.AskContacts -> askContacts()
            is Row.Header -> {}
        }
    }

    private fun askContacts() {
        // After a "don't ask again" the system won't show the prompt, so send them to app settings.
        if (prefs.askedContacts && !shouldShowRequestPermissionRationale(Manifest.permission.READ_CONTACTS)) {
            AppActions.safeStart(this, Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.parse("package:$packageName")))
        } else {
            prefs.askedContacts = true
            requestPermissions(arrayOf(Manifest.permission.READ_CONTACTS), REQ_CONTACTS)
        }
    }

    private fun launch(app: AppEntry) {
        AppActions.launch(this, app, prefs)
        finish()
    }

    private fun openContact(c: Contact) {
        val uri = ContactsContract.Contacts.getLookupUri(c.id, c.lookupKey)
        AppActions.safeStart(this, Intent(Intent.ACTION_VIEW, uri))
        finish()
    }

    private fun dial(c: Contact) {
        AppActions.safeStart(this, Intent(Intent.ACTION_DIAL, Uri.fromParts("tel", c.number, null)))
        finish()
    }

    private fun message(c: Contact) {
        AppActions.safeStart(this, Intent(Intent.ACTION_SENDTO, Uri.fromParts("smsto", c.number, null)))
        finish()
    }

    // ------------------------------------------------------------------ adapter

    private inner class RowsAdapter : BaseAdapter() {
        var rows: List<Row> = emptyList()

        override fun getCount() = rows.size
        override fun getItem(position: Int) = rows[position]
        override fun getItemId(position: Int) = position.toLong()
        override fun getViewTypeCount() = 4
        override fun getItemViewType(position: Int) = when (rows[position]) {
            is Row.App -> 0
            is Row.Person -> 1
            is Row.Header -> 2
            Row.AskContacts -> 3
        }
        override fun isEnabled(position: Int) = rows[position] !is Row.Header

        override fun getView(position: Int, convertView: View?, parent: ViewGroup): View =
            when (val row = rows[position]) {
                is Row.App -> appView(row.app, convertView as? LinearLayout)
                is Row.Person -> personView(row.contact, convertView as? LinearLayout)
                is Row.Header -> ((convertView as? TextView) ?: headerView()).apply { text = row.title }
                Row.AskContacts -> (convertView as? TextView) ?: askView()
            }

        private fun appView(app: AppEntry, recycled: LinearLayout?): View {
            val row = recycled ?: LinearLayout(this@AllAppsActivity).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(dpi(4), dpi(10), dpi(4), dpi(10))
                addView(ImageView(context).apply { importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO },
                    LinearLayout.LayoutParams(dpi(40), dpi(40)))
                addView(TextView(context).apply {
                    textSize = 17f
                    setTextColor(prefs.leftText)
                    isSingleLine = true
                }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply { marginStart = dpi(16) })
                addView(TextView(context).apply {
                    textSize = 12f
                    setTextColor(prefs.highlight)
                })
            }
            (row.getChildAt(0) as ImageView).setImageBitmap(app.icon)
            (row.getChildAt(1) as TextView).text = app.label
            (row.getChildAt(2) as TextView).text = when (app.key) {
                in prefs.pinned -> "pinned"
                in prefs.hidden -> "hidden"
                else -> ""
            }
            return row
        }

        private fun personView(c: Contact, recycled: LinearLayout?): View {
            val row = recycled ?: LinearLayout(this@AllAppsActivity).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(dpi(4), dpi(6), 0, dpi(6))
                addView(TextView(context).apply { // initial in a circle
                    gravity = Gravity.CENTER
                    textSize = 17f
                    setTextColor(prefs.leftBg)
                    background = GradientDrawable().apply {
                        shape = GradientDrawable.OVAL
                        setColor(prefs.highlight)
                    }
                    importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
                }, LinearLayout.LayoutParams(dpi(40), dpi(40)))
                addView(LinearLayout(context).apply {
                    orientation = LinearLayout.VERTICAL
                    addView(TextView(context).apply { textSize = 17f; setTextColor(prefs.leftText); isSingleLine = true })
                    addView(TextView(context).apply {
                        textSize = 13f; setTextColor(Colors.withAlpha(prefs.leftText, 0.6f)); isSingleLine = true
                    })
                }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply { marginStart = dpi(16) })
                addView(actionButton(android.R.drawable.sym_action_call))
                addView(actionButton(android.R.drawable.sym_action_chat))
            }
            (row.getChildAt(0) as TextView).text = c.name.firstOrNull()?.uppercase() ?: "?"
            val texts = row.getChildAt(1) as LinearLayout
            (texts.getChildAt(0) as TextView).text = c.name
            (texts.getChildAt(1) as TextView).text = c.number
            row.getChildAt(2).apply {
                contentDescription = "Call ${c.name}"
                setOnClickListener { dial(c) }
            }
            row.getChildAt(3).apply {
                contentDescription = "Message ${c.name}"
                setOnClickListener { message(c) }
            }
            return row
        }

        private fun actionButton(icon: Int) = ImageButton(this@AllAppsActivity).apply {
            setImageResource(icon)
            setColorFilter(prefs.highlight, PorterDuff.Mode.SRC_IN)
            val ta = context.obtainStyledAttributes(intArrayOf(android.R.attr.selectableItemBackgroundBorderless))
            background = ta.getDrawable(0)
            ta.recycle()
            isFocusable = false // keep the row itself clickable in a ListView
            layoutParams = LinearLayout.LayoutParams(dpi(48), dpi(48))
        }

        private fun headerView() = TextView(this@AllAppsActivity).apply {
            textSize = 12f
            isAllCaps = true
            letterSpacing = 0.08f
            setTextColor(prefs.highlight)
            setPadding(dpi(4), dpi(14), dpi(4), dpi(4))
        }

        private fun askView() = TextView(this@AllAppsActivity).apply {
            text = "Search contacts too?  Tap to allow access  ›"
            textSize = 14f
            setTextColor(prefs.leftText)
            setPadding(dpi(14), dpi(12), dpi(14), dpi(12))
            background = GradientDrawable().apply {
                cornerRadius = dp(12f)
                setColor(Colors.withAlpha(prefs.leftText, 0.08f))
            }
        }
    }

    private companion object {
        const val REQ_CONTACTS = 11
        const val MAX_CONTACTS = 8
    }
}
