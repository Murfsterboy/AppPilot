package com.apppilot.companyready

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ContentTest {
    @Test fun journeyIsComplete() {
        val steps = Journey.steps
        assertEquals(12, steps.size)
        assertEquals(steps.size, steps.map { it.id }.toSet().size)
        for (s in steps) {
            assertTrue("${s.id} lessons", s.lessons.isNotEmpty())
            assertTrue("${s.id} tasks", s.tasks.isNotEmpty())
            assertTrue("${s.id} links", s.links.isNotEmpty())
            assertTrue("${s.id} quiz", s.quiz.size >= 3)
            for (q in s.quiz) assertTrue("${s.id}: ${q.q}", q.answer in q.options.indices)
        }
    }

    @Test fun taskIdsAreUnique() {
        val ids = Journey.steps.flatMap { s -> s.tasks.map { it.id } }
        assertEquals(ids.size, ids.toSet().size)
    }

    @Test fun allLinksAreHttps() {
        val links = Journey.steps.flatMap { s -> s.links + s.tasks.mapNotNull { it.link } }
        for (l in links) assertTrue(l.url, l.url.startsWith("https://"))
    }

    @Test fun boldMarkersArePaired() {
        for (s in Journey.steps) for (l in s.lessons) {
            assertEquals("Unpaired ** in ${s.id}/${l.title}", 0, Regex("\\*\\*").findAll(l.body).count() % 2)
        }
    }

    @Test fun glossaryHasNoDuplicates() {
        assertEquals(Glossary.terms.size, Glossary.terms.map { it.first }.toSet().size)
    }

    @Test fun categoryKeysUnique() {
        assertEquals(Categories.all.size, Categories.all.map { it.key }.toSet().size)
    }
}
