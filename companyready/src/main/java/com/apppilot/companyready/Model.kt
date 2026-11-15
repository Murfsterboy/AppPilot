package com.apppilot.companyready

data class Link(val title: String, val url: String, val note: String = "")

data class Lesson(
    val title: String,
    val body: String,
    val tip: String? = null,
    val warning: String? = null,
)

data class Task(
    val id: String,
    val text: String,
    val detail: String? = null,
    val link: Link? = null,
)

data class Question(
    val q: String,
    val options: List<String>,
    val answer: Int,
    val explain: String,
)

enum class Tool(val label: String) {
    RECORDS("Open your financial records"),
    DEADLINES("Work out your deadlines"),
    TAKE_HOME("Compare salary, dividends and sole trader"),
    VAT_CHECK("Check your VAT threshold"),
    MILEAGE("Open your mileage log"),
}

data class Step(
    val id: String,
    val title: String,
    val summary: String,
    val minutes: Int,
    val icon: String,
    val lessons: List<Lesson>,
    val tasks: List<Task>,
    val links: List<Link>,
    val quiz: List<Question>,
    val tools: List<Tool> = emptyList(),
)

object Journey {
    val steps: List<Step> by lazy { JourneyA.steps + JourneyB.steps + JourneyC.steps }
    fun step(id: String) = steps.first { it.id == id }
    fun index(id: String) = steps.indexOfFirst { it.id == id }
}
