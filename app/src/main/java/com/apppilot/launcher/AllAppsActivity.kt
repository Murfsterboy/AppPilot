package com.apppilot.launcher

import android.app.Activity
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.inputmethod.EditorInfo
import android.widget.BaseAdapter
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ListView
import android.widget.TextView

/** Alphabetical list of every app, with search. Long-press an app to pin, hide, or uninstall it. */
class AllAppsActivity : Activity() {

    private lateinit var prefs: Prefs
    private lateinit var repo: AppRepository
    private lateinit var search: EditText
    private val adapter = AppsAdapter()
    private var all: List<AppEntry> = emptyList()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = Prefs(this)
        repo = AppRepository(this, prefs)
        window.statusBarColor = prefs.leftBg
        window.navigationBarColor = prefs.leftBg

        val text = prefs.leftText
        search = EditText(this).apply {
            hint = "Search apps"
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
                override fun afterTextChanged(s: Editable?) = filter(s?.toString().orEmpty())
            })
            setOnEditorActionListener { _, actionId, _ ->
                if (actionId == EditorInfo.IME_ACTION_GO) {
                    adapter.items.firstOrNull()?.let { launch(it) }
                    true
                } else false
            }
        }

        val list = ListView(this).apply {
            adapter = this@AllAppsActivity.adapter
            divider = null
            isFastScrollEnabled = true
            setOnItemClickListener { _, _, pos, _ -> launch(this@AllAppsActivity.adapter.items[pos]) }
            setOnItemLongClickListener { _, _, pos, _ ->
                AppActions.showMenu(this@AllAppsActivity, this@AllAppsActivity.adapter.items[pos], prefs) {
                    this@AllAppsActivity.adapter.notifyDataSetChanged()
                }
                true
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
            filter(search.text.toString())
        }
    }

    override fun onDestroy() {
        repo.shutdown()
        super.onDestroy()
    }

    private fun filter(q: String) {
        val query = q.trim().lowercase()
        adapter.items = if (query.isEmpty()) all else {
            // Names starting with the query first, then names containing it.
            val starts = all.filter { it.label.lowercase().startsWith(query) }
            val words = all.filter { a -> a !in starts && a.label.lowercase().split(' ').any { it.startsWith(query) } }
            val contains = all.filter { it !in starts && it !in words && it.label.lowercase().contains(query) }
            starts + words + contains
        }
        adapter.notifyDataSetChanged()
    }

    private fun launch(app: AppEntry) {
        AppActions.launch(this, app, prefs)
        finish()
    }

    private inner class AppsAdapter : BaseAdapter() {
        var items: List<AppEntry> = emptyList()

        override fun getCount() = items.size
        override fun getItem(position: Int) = items[position]
        override fun getItemId(position: Int) = position.toLong()

        override fun getView(position: Int, convertView: View?, parent: ViewGroup): View {
            val row = (convertView as? LinearLayout) ?: makeRow()
            val app = items[position]
            val icon = row.getChildAt(0) as ImageView
            val label = row.getChildAt(1) as TextView
            val tag = row.getChildAt(2) as TextView
            icon.setImageBitmap(app.icon)
            label.text = app.label
            tag.text = when (app.key) {
                in prefs.pinned -> "pinned"
                in prefs.hidden -> "hidden"
                else -> ""
            }
            return row
        }

        private fun makeRow(): LinearLayout = LinearLayout(this@AllAppsActivity).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dpi(4), dpi(10), dpi(4), dpi(10))
            addView(ImageView(context), LinearLayout.LayoutParams(dpi(40), dpi(40)))
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
    }
}
