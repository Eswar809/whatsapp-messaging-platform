# WhatsApp Message Templates — Submission Specs

Pratham AI Labs sends **three** proactive (business-initiated) messages that go **outside the 24-hour customer-service window**, so each one **must** use a pre-approved WhatsApp message template. Inside the 24 h window the bot replies with free-form/interactive messages and does **not** need these templates.

The template **names** and **parameter counts** below are taken directly from the code and must match `.env` exactly, or proactive sends will fail.

| Template name (`.env`) | Used by | Category | Language | Body params |
| --- | --- | --- | --- | --- |
| `daily_mcq` (`TPL_DAILY_MCQ`) | `src/jobs/scheduler.ts` → `runDailyMcq` | **UTILITY** | `en` | **2** → {{1}} subject, {{2}} question |
| `reengage_v1` (`TPL_REENGAGE`) | `src/features/reengage.ts` → `reengageStale` | **UTILITY** (Marketing also acceptable) | `en` | **1** → {{1}} student name |
| `result_felicitation` (`TPL_RESULT`) | `src/features/broadcast.ts` → `resultBlast` | **MARKETING** | `en` | **1** → {{1}} student name |

> Param-count verification (from source):
> - `daily_mcq`: `bodyParams: [q.subject, q.question]` → **2 params**.
> - `reengage_v1`: `bodyParams: [s.name ?? "there"]` → **1 param**.
> - `result_felicitation`: `bodyParams: ... [s.name ?? "Student"]` → **1 param**.

---

## 1. `daily_mcq` — UTILITY · en · 2 params

The daily practice question pushed to opted-in students. Utility because it is a recurring, expected, non-promotional service message tied to the student's enrolment.

**Body text (paste into the Body field):**
```
Your daily {{1}} practice question:

{{2}}

Reply with your answer (A/B/C/D) to log your attempt and keep your streak going.
```

**Sample values (required by Meta to approve):**
- {{1}} = `Direct Tax`
- {{2}} = `Under Section 80C, what is the maximum deduction available for an individual in a financial year?`

**Rendered sample:**
> Your daily Direct Tax practice question:
>
> Under Section 80C, what is the maximum deduction available for an individual in a financial year?
>
> Reply with your answer (A/B/C/D) to log your attempt and keep your streak going.

**Notes**
- Exactly **2** body variables — do not add/remove, the code passes `[subject, question]` in this order.
- Keep it **non-promotional** (no offers/discounts) so it qualifies as UTILITY.
- No header/footer/buttons are required by the code (you may add an optional footer like "Pratham AI Labs" if you wish — it does not take a parameter).

---

## 2. `reengage_v1` — UTILITY (or MARKETING) · en · 1 param

Sent to students who have gone quiet for `REENGAGE_AFTER_DAYS` (default 7). A gentle nudge to come back to practice.

**Body text:**
```
Hi {{1}}, we have missed you at Pratham AI Labs! Your daily practice is waiting. Reply here to pick up your next question and get back on track.
```

**Sample value:**
- {{1}} = `Anjali`

**Rendered sample:**
> Hi Anjali, we have missed you at Pratham AI Labs! Your daily practice is waiting. Reply here to pick up your next question and get back on track.

**Notes**
- Exactly **1** body variable ({{1}} = student name; the code falls back to "there" when name is missing, so the wording reads naturally either way).
- Can be submitted as **UTILITY** (framed as a service reminder about an existing relationship) or **MARKETING** if you later add promotional wording. UTILITY is cheaper and preferred — keep the copy reminder-style, not salesy.

---

## 3. `result_felicitation` — MARKETING · en · 1 param

Result-day blast congratulating students. This is celebratory/relationship/brand messaging, so it is **MARKETING** (not UTILITY).

**Body text:**
```
Congratulations, {{1}}! The whole team at Pratham AI Labs is proud of your hard work and results. This is a big milestone in your CA/CMA/CS journey, and we are honoured to be part of it. Onward to the next goal!
```

**Sample value:**
- {{1}} = `Rohan`

**Rendered sample:**
> Congratulations, Rohan! The whole team at Pratham AI Labs is proud of your hard work and results. This is a big milestone in your CA/CMA/CS journey, and we are honoured to be part of it. Onward to the next goal!

**Notes**
- Exactly **1** body variable ({{1}} = student name; code falls back to "Student").
- Submit as **MARKETING** — congratulatory/brand content does not qualify as UTILITY and will be rejected or recategorised if mislabelled.

---

## How to create & submit each template

Do this for **all three** templates. They must be **Approved** before the bot can send them; until then proactive sends fail.

1. Go to **WhatsApp Manager** (https://business.facebook.com/wa/manage) → select your WhatsApp Business Account → **Message Templates**.
2. Click **Create Template**.
3. **Category:** choose exactly as specified above (`daily_mcq` = Utility, `reengage_v1` = Utility, `result_felicitation` = Marketing).
4. **Name:** type the **exact** name (lowercase, underscores) — `daily_mcq`, `reengage_v1`, `result_felicitation`. These must match `TPL_DAILY_MCQ` / `TPL_REENGAGE` / `TPL_RESULT` in `.env`.
5. **Language:** choose **English** (`en`) — must match `TPL_LANG=en`.
6. **Body:** paste the body text above. Use the **Add variable** button to insert `{{1}}` / `{{2}}` (do not type the braces by hand inconsistently — use the editor) and make sure the variable count matches the table.
7. **Sample content:** fill in the sample values listed above for every variable (Meta requires samples to review).
8. (Optional) Add a footer such as "Pratham AI Labs" — footers take no parameters and don't change the code.
9. Click **Submit**. Status goes to **Pending** → then **Approved** or **Rejected** (usually within minutes to a few hours).
10. After approval, confirm the **approved name + language** exactly match `.env`. Restart the app if you changed `.env`.

---

## Approval tips

- **UTILITY must stay non-promotional.** No offers, discounts, "enrol now", emojis-as-marketing, or sales CTAs in `daily_mcq` / `reengage_v1` — otherwise Meta recategorises them as Marketing (more expensive) or rejects them.
- **Keep MARKETING honestly labelled.** `result_felicitation` is celebratory/brand — submitting it as Utility risks rejection.
- **Match samples to real content.** Vague or placeholder-only samples (e.g. "test") get rejected; use realistic values like those above.
- **No URLs/phone numbers floating in body text** unless intended; avoid anything that looks like spam.
- **Variable placement:** never start or end the body with a variable, and never put two variables next to each other with no text between — Meta rejects those. The bodies above already follow this.
- **Variable count is load-bearing:** the code passes a fixed number of params per template (2 / 1 / 1). If the approved template has a different count, the send will error. Re-check the table after any edit.
- If a template is **rejected**, edit the wording (or fix the category) and resubmit — you do not need to change the name.
