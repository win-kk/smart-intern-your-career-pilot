const state = {
  user: null,
  page: "overview",
  profile: null,
  matches: [],
  applications: [],
  skills: [],
  education: [],
  certifications: [],
  experienceCatalog: [],
  companyInternships: [],
  selectedInternship: null,
  selectedOpportunityId: null,
};
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
async function api(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 3000);
}
function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}
function empty(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}
function statusClass(status) {
  return status === "Qualified" || status === "Accepted"
    ? "status-qualified"
    : status === "Not fully qualified" || status === "Rejected"
      ? "status-partial"
      : status === "Under Review"
        ? "status-review"
      : "status-pending";
}

const loginMatchExamples = [
  {
    title: "Software Developer Intern",
    company: "TechNova Systems",
    score: 85,
    skills: [
      ["Java", true],
      ["SQL", true],
      ["Python", true],
      ["React", false],
    ],
    gpa: "3.5 / 3.0 req.",
    qualification: "Meets requirement",
  },
  {
    title: "Data Analyst Intern",
    company: "DataSpark Analytics",
    score: 78,
    skills: [
      ["SQL", true],
      ["Excel", true],
      ["Python", true],
      ["Tableau", false],
    ],
    gpa: "3.2 / 3.0 req.",
    qualification: "Meets requirement",
  },
  {
    title: "Frontend Developer Intern",
    company: "PixelWorks Studio",
    score: 92,
    skills: [
      ["HTML/CSS", true],
      ["JavaScript", true],
      ["React", true],
      ["Git", true],
    ],
    gpa: "3.7 / 3.2 req.",
    qualification: "Meets requirement",
  },
];

function setupLoginPreview() {
  const card = $("#preview-card");
  if (!card) return;
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  let exampleIndex = 0;
  const showExample = (index) => {
    const example = loginMatchExamples[index];
    $("#preview-title").textContent = example.title;
    $("#preview-company").textContent = example.company;
    $("#preview-score").textContent = `${example.score}% Match`;
    $("#preview-gpa").textContent = `GPA: ${example.gpa}`;
    $("#preview-qualification").textContent = example.qualification;
    $("#preview-tags").replaceChildren(
      ...example.skills.map(([skill, matched]) => {
        const tag = document.createElement("span");
        tag.textContent = `${matched ? "OK" : "X"} ${skill}`;
        if (!matched) tag.classList.add("tag-missing");
        return tag;
      }),
    );
    document.querySelectorAll(".preview-dot").forEach((dot, dotIndex) => {
      const active = dotIndex === index;
      dot.classList.toggle("active", active);
      dot.setAttribute("aria-pressed", String(active));
    });
    card.classList.remove("is-changing");
    void card.offsetWidth;
    card.classList.add("is-changing");
  };
  document.querySelectorAll(".preview-dot").forEach((dot, index) => {
    dot.addEventListener("click", () => {
      exampleIndex = index;
      showExample(exampleIndex);
    });
  });
  if (!reduceMotion) {
    window.setInterval(() => {
      if (document.hidden) return;
      exampleIndex = (exampleIndex + 1) % loginMatchExamples.length;
      showExample(exampleIndex);
    }, 4500);
  }
}

function setupLogin() {
  document.querySelectorAll(".role-button").forEach((button) =>
    button.addEventListener("click", () => {
      document.querySelectorAll(".role-button").forEach((item) => {
        item.classList.remove("active");
        item.setAttribute("aria-pressed", "false");
      });
      button.classList.add("active");
      button.setAttribute("aria-pressed", "true");
      $("#login-role").value = button.dataset.role;
    }),
  );
  $("#toggle-password").addEventListener("click", () => {
    const input = $("#login-password");
    const visible = input.type === "password";
    input.type = visible ? "text" : "password";
    $("#toggle-password").textContent = visible ? "Hide" : "Show";
    $("#toggle-password").setAttribute(
      "aria-label",
      visible ? "Hide password" : "Show password",
    );
  });
  $("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    const submit = $("#login-submit");
    const errorBox = $("#login-error");
    errorBox.classList.add("hidden");
    submit.disabled = true;
    submit.textContent = "Signing in...";
    try {
      state.user = await api("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: $("#login-role").value,
          email: $("#login-email").value.trim(),
          password: $("#login-password").value,
        }),
      });
      await bootApp();
    } catch (error) {
      errorBox.textContent =
        error.message ||
        "We could not sign you in. Check your details and try again.";
      errorBox.classList.remove("hidden");
      errorBox.focus();
      submit.disabled = false;
      submit.textContent = "Log in";
    }
  });
}
function navItems() {
  return state.user.role === "Student"
    ? [
        ["overview", "Find jobs"],
        ["applications", "My applications"],
        ["profile", "My profile"],
        ["insights", "Analytics"],
      ]
    : [
        ["overview", "Overview"],
        ["internships", "Internships"],
        ["applicants", "Applicants"],
        ["company-profile", "Company profile"],
        ["reports", "Reports"],
      ];
}
function renderShell() {
  $("#login-screen").classList.add("hidden");
  $("#app-shell").classList.remove("hidden");
  $("#app-shell").classList.toggle("student-workspace-shell", state.user.role === "Student");
  $("#app-shell").classList.toggle(
    "student-discovery-shell",
    state.user.role === "Student" && state.page === "overview",
  );
  $("#sidebar-user").innerHTML =
    `<strong>${escapeHtml(state.user.email)}</strong><span>${escapeHtml(state.user.role)} account</span>`;
  $("#main-nav").innerHTML = navItems()
    .map(
      ([id, label]) =>
        `<button class="nav-button ${state.page === id ? "active" : ""}" data-page="${id}" aria-current="${state.page === id ? "page" : "false"}">${label}</button>`,
    )
    .join("");
  $("#student-nav-user").textContent = state.user.email;
  $("#student-top-nav").innerHTML = navItems()
    .map(([id, label]) => `<button class="student-nav-button ${state.page === id ? "active" : ""}" data-page="${id}" aria-current="${state.page === id ? "page" : "false"}">${label}</button>`)
    .join("");
  $("#student-site-header").classList.toggle("hidden", state.user.role !== "Student");
  document.querySelectorAll(".nav-button").forEach(
    (button) =>
      (button.onclick = () => {
        state.page = button.dataset.page;
        renderShell();
        renderPage();
      }),
  );
  document.querySelectorAll(".student-nav-button").forEach(
    (button) => (button.onclick = () => {
      state.page = button.dataset.page;
      state.selectedOpportunityId = null;
      if (state.page === "profile") {
        state.profileMode = "preview";
        state.cvDraft = null;
      }
      renderShell();
      renderPage();
    }),
  );
  $(".student-site-brand").onclick = (event) => {
    event.preventDefault();
    state.page = "overview";
    state.selectedOpportunityId = null;
    renderShell();
    renderPage();
  };
  const signOut = async (button) => {
    button.disabled = true;
    button.textContent = "Signing out...";
    try {
      await api("/api/auth/logout", { method: "POST" });
      window.location.reload();
    } catch (error) {
      showToast(error.message);
      button.disabled = false;
      button.textContent = "Sign out";
    }
  };
  $("#logout-button").onclick = () => signOut($("#logout-button"));
  $("#student-signout").onclick = () => signOut($("#student-signout"));
}
async function loadStudentData() {
  [
    state.profile,
    state.matches,
    state.applications,
    state.skills,
    state.education,
    state.certifications,
    state.experienceCatalog,
  ] = await Promise.all([
    api("/api/student/profile"),
    api("/api/student/matches"),
    api("/api/student/applications"),
    api("/api/catalog/skills"),
    api("/api/catalog/education"),
    api("/api/catalog/certifications"),
    api("/api/catalog/experience"),
  ]);
}
async function loadCompanyData() {
  state.companyInternships = await api("/api/company/internships");
}
function pageHeader(kicker, title) {
  $("#page-kicker").textContent = kicker;
  $("#page-title").textContent = title;
}
function matchAnalysis(m) {
  const skills = Number(m.total_skills)
    ? (Number(m.failed_mandatory_skills) > 0 ? 0 : Number(m.satisfied_skills) / Number(m.total_skills) * 60)
    : 0;
  const gpa = Number(m.gpa) >= Number(m.min_gpa) ? Number(m.gpa) / 4 * 20 : 0;
  const year = Number(m.study_year) >= Number(m.min_study_year) ? Number(m.study_year) / 4 * 20 : 0;
  const gaps = [];
  if (m.missing_mandatory_skills) gaps.push(`Add or improve: ${escapeHtml(m.missing_mandatory_skills)}.`);
  else if (Number(m.satisfied_skills) < Number(m.total_skills)) gaps.push("You meet the mandatory skill checks; building proficiency in the other listed skills could strengthen your match.");
  if (Number(m.gpa) < Number(m.min_gpa)) gaps.push(`Your GPA is below the ${m.min_gpa} minimum.`);
  if (Number(m.study_year) < Number(m.min_study_year)) gaps.push(`This role requires study year ${m.min_study_year} or above.`);
  const feedback = gaps.length ? gaps.join(" ") : "You meet the listed minimum requirements. Keep your skills and education profile up to date.";
  return `<section class="match-analysis" aria-label="Match analysis"><div class="analysis-heading"><div><span class="eyebrow">Your match analysis</span><h4>What contributed to your fit</h4></div><strong>${Number(m.match_score).toFixed(0)}%</strong></div><div class="analysis-breakdown"><div><span>Skills</span><strong>${skills.toFixed(1)} / 60</strong></div><div><span>GPA</span><strong>${gpa.toFixed(1)} / 20</strong><small>${m.gpa} GPA · ${m.min_gpa} required</small></div><div><span>Study year</span><strong>${year.toFixed(1)} / 20</strong><small>Year ${m.study_year} · ${m.min_study_year} required</small></div></div><p class="analysis-feedback"><strong>Feedback</strong> ${feedback}</p></section>`;
}
function bindApplyButtons() {
  document.querySelectorAll(".apply-button:not([disabled])").forEach(
    (button) =>
      (button.onclick = async () => {
        button.disabled = true;
        button.textContent = "Applying...";
        try {
          const result = await api("/api/student/applications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ internshipId: Number(button.dataset.id) }),
          });
          showToast(
            "Application submitted. Opening your application analytics.",
          );
          state.page = "insights";
          renderShell();
          await renderPage();
        } catch (error) {
          button.disabled = false;
          button.textContent = "Apply now";
          showToast(error.message);
        }
      }),
  );
}
async function studentOverview() {
  await loadStudentData();
  const p = state.profile.profile;
  pageHeader("Student workspace", "Overview");
  const openMatches = state.matches.filter((m) => !m.has_applied && !m.application_id);
  const companies = [...new Set(openMatches.map((m) => m.company_name))].sort((a, b) => a.localeCompare(b));
  const requiredSkills = [...new Set(openMatches.flatMap((m) => String(m.required_skills || "").split(", ").filter(Boolean)))].sort((a, b) => a.localeCompare(b));
  const selected = openMatches.find((m) => Number(m.internship_id) === Number(state.selectedOpportunityId));
  if (selected) {
    renderOpportunityDetails(selected, openMatches, p.first_name);
    return;
  }
  state.selectedOpportunityId = null;
  $("#page-content").innerHTML =
    `<section class="discovery-hero"><div class="discovery-hero-copy"><p class="eyebrow">Student workspace</p><h2>Welcome back, ${escapeHtml(p.first_name)}</h2><p>Search internships from participating companies and explore the requirements before applying.</p></div><form class="discovery-search" id="opportunity-search"><label class="search-field"><span aria-hidden="true">⌕</span><input name="keyword" type="search" placeholder="Job title, company, or skill" aria-label="Search by job title, company, or skill"></label><button class="primary-button" type="submit">Search</button></form></section><section class="discovery-section"><div class="discovery-title-row"><div><p class="eyebrow">SmartIntern · Internship discovery</p><h2>Opportunities from participating companies</h2><p id="opportunity-count" class="muted"></p></div><label class="sort-control">Sort by<select id="opportunity-sort"><option value="relevance">Best fit</option><option value="company">Company name</option><option value="title">Job title</option></select></label></div><div class="discovery-layout"><aside class="filter-panel"><div class="filter-heading"><h3>Filters</h3><button type="button" class="text-button" id="clear-opportunity-filters">Clear all</button></div><label class="filter-label" for="company-filter">Company</label><select id="company-filter"><option value="">All companies</option>${companies.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}</select><label class="filter-label" for="fit-filter">Requirements</label><select id="fit-filter"><option value="all">All opportunities</option><option value="qualified">Meets minimums</option><option value="improve">Needs improvement</option></select><label class="filter-label" for="gpa-filter">Minimum GPA</label><select id="gpa-filter"><option value="">Any requirement</option><option value="3">3.0 or below</option><option value="3.5">3.5 or below</option><option value="4">4.0 or below</option></select><label class="filter-label" for="year-filter">Minimum study year</label><select id="year-filter"><option value="">Any year</option><option value="2">Year 2 or below</option><option value="3">Year 3 or below</option><option value="4">Year 4 or below</option></select>${requiredSkills.length ? `<label class="filter-label" for="skill-filter">Required skill</label><select id="skill-filter"><option value="">Any skill</option>${requiredSkills.map((skill) => `<option value="${escapeHtml(skill)}">${escapeHtml(skill)}</option>`).join("")}</select>` : ""}<p class="filter-note">Filters use the internship requirements saved by each company.</p></aside><div class="opportunity-grid-wrap"><div class="opportunity-grid" id="opportunity-results"></div></div></div></section>`;
  const searchForm = $("#opportunity-search");
  const controls = [$("#company-filter"), $("#fit-filter"), $("#gpa-filter"), $("#year-filter"), $("#skill-filter"), $("#opportunity-sort")].filter(Boolean);
  const renderResults = () => {
    const keyword = searchForm.elements.keyword.value.trim().toLowerCase();
    const company = $("#company-filter").value;
    const fit = $("#fit-filter").value;
    const maxGpa = Number($("#gpa-filter").value || Infinity);
    const maxYear = Number($("#year-filter").value || Infinity);
    const skill = $("#skill-filter")?.value || "";
    const sort = $("#opportunity-sort").value;
    let results = openMatches.filter((m) => {
      const text = `${m.title} ${m.company_name} ${m.required_skills || ""}`.toLowerCase();
      const qualified = m.qualification_status === "Qualified";
      return (!keyword || text.includes(keyword)) && (!company || m.company_name === company) && (fit === "all" || (fit === "qualified" ? qualified : !qualified)) && Number(m.min_gpa) <= maxGpa && Number(m.min_study_year) <= maxYear && (!skill || String(m.required_skills || "").split(", ").includes(skill));
    });
    if (sort === "company") results.sort((a, b) => a.company_name.localeCompare(b.company_name));
    if (sort === "title") results.sort((a, b) => a.title.localeCompare(b.title));
    $("#opportunity-count").textContent = `${results.length} of ${openMatches.length} opportunities · ${companies.length} ${companies.length === 1 ? "company" : "companies"}`;
    $("#opportunity-results").innerHTML = results.length ? results.map(opportunityCard).join("") : empty("No opportunities match those filters. Try changing your search or clearing a filter.");
    document.querySelectorAll(".opportunity-card").forEach((card) => {
      card.onclick = (event) => {
        if (event.target.closest(".apply-button")) return;
        state.selectedOpportunityId = Number(card.dataset.id);
        studentOverview();
      };
      card.onkeydown = (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          state.selectedOpportunityId = Number(card.dataset.id);
          studentOverview();
        }
      };
    });
    bindApplyButtons();
  };
  searchForm.onsubmit = (event) => { event.preventDefault(); renderResults(); };
  searchForm.elements.keyword.oninput = renderResults;
  controls.forEach((control) => control.addEventListener("change", renderResults));
  $("#clear-opportunity-filters").onclick = () => {
    searchForm.reset();
    controls.forEach((control) => { control.value = ""; });
    $("#fit-filter").value = "all";
    $("#opportunity-sort").value = "relevance";
    renderResults();
  };
  renderResults();
}
function opportunityCard(m) {
  const skillTags = String(m.required_skills || "").split(", ").filter(Boolean).slice(0, 4);
  const hasMore = String(m.required_skills || "").split(", ").filter(Boolean).length - skillTags.length;
  return `<article class="opportunity-card" data-id="${m.internship_id}" tabindex="0" aria-label="View ${escapeHtml(m.title)} at ${escapeHtml(m.company_name)}"><div class="opportunity-card-top"><span class="company-avatar" aria-hidden="true">${escapeHtml(String(m.company_name || "C").trim().charAt(0).toUpperCase())}</span><span class="role-type">Internship</span></div><h3>${escapeHtml(m.title)}</h3><p class="company-name">${escapeHtml(m.company_name)} · ${Number(m.applicant_count || 0)} applicants</p><p class="role-summary">${escapeHtml(m.company_description || "Explore this role and review its requirements before applying.")}</p><div class="opportunity-tags">${skillTags.map((tag) => `<span class="opportunity-tag">${escapeHtml(tag)}</span>`).join("")}${hasMore > 0 ? `<span class="opportunity-tag">+${hasMore} more</span>` : ""}</div><div class="requirement-summary"><span>Minimum GPA <strong>${Number(m.min_gpa).toFixed(1)}</strong></span><span>Study year <strong>${Number(m.min_study_year)}+</strong></span></div><div class="opportunity-card-actions"><span class="muted">${m.qualification_status === "Qualified" ? "Meets minimums" : "Review requirements"}</span><button type="button" class="primary-button apply-button" data-id="${m.internship_id}">Apply</button></div></article>`;
}
function renderOpportunityDetails(selected, opportunities, firstName) {
  const list = opportunities.map((item) => `<button type="button" class="detail-role-option ${Number(item.internship_id) === Number(selected.internship_id) ? "active" : ""}" data-id="${item.internship_id}"><span class="company-avatar" aria-hidden="true">${escapeHtml(String(item.company_name || "C").trim().charAt(0).toUpperCase())}</span><span class="detail-role-copy"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.company_name)} · ${Number(item.applicant_count || 0)} applicants</small><span class="opportunity-tags">${String(item.required_skills || "").split(", ").filter(Boolean).slice(0, 2).map((skill) => `<i class="opportunity-tag">${escapeHtml(skill)}</i>`).join("")}</span></span></button>`).join("");
  const mandatory = String(selected.mandatory_skills || "").split(", ").filter(Boolean);
  const optional = String(selected.optional_skills || "").split(", ").filter(Boolean);
  const description = selected.company_description || "This company has not added a profile description yet.";
  $("#page-content").innerHTML = `<section class="detail-hero"><p class="eyebrow">Student workspace · Welcome back, ${escapeHtml(firstName)}</p><h2>Explore the opportunity</h2><p>Review the role details and requirements before you apply.</p></section><div class="detail-toolbar"><button type="button" class="secondary-button" id="back-to-opportunities">← Back to opportunities</button><span class="muted">${opportunities.length} open roles from ${new Set(opportunities.map((item) => item.company_name)).size} companies</span></div><section class="opportunity-detail-layout"><aside class="detail-role-list" aria-label="Other open internships"><div class="detail-list-heading"><h3>Open opportunities</h3><span>${opportunities.length}</span></div>${list || empty("No other open opportunities.")}</aside><article class="role-detail-main"><div class="role-detail-heading"><div><p class="eyebrow">${escapeHtml(selected.company_name)}</p><h1>${escapeHtml(selected.title)}</h1><p class="company-name">${Number(selected.applicant_count || 0)} applicants</p></div><span class="role-type">Internship</span></div><div class="role-detail-section"><h2>About the role</h2><p>This internship is offered by ${escapeHtml(selected.company_name)}. The posting includes the eligibility requirements and skill expectations below so you can review the fit before applying.</p></div><div class="role-detail-section"><h2>Eligibility</h2><div class="eligibility-grid"><div><span>Minimum GPA</span><strong>${Number(selected.min_gpa).toFixed(2)} / 4.00</strong><small>Your current GPA: ${escapeHtml(selected.gpa)}</small></div><div><span>Study year</span><strong>Year ${Number(selected.min_study_year)} or above</strong><small>Your current year: ${escapeHtml(selected.study_year)}</small></div></div></div><div class="role-detail-section"><h2>Required skills</h2><p class="muted">Skills marked as mandatory are eligibility requirements for this role.</p><div class="detail-skill-list">${mandatory.map((skill) => `<span class="detail-skill mandatory">${escapeHtml(skill)} <small>Required</small></span>`).join("") || `<span class="muted">No mandatory skills are listed.</span>`}${optional.map((skill) => `<span class="detail-skill">${escapeHtml(skill)} <small>Additional</small></span>`).join("")}</div></div><div class="role-detail-section company-description-inline"><h2>About ${escapeHtml(selected.company_name)}</h2><p>${escapeHtml(description)}</p></div></article><aside class="company-detail-side"><section class="company-info-card"><div class="company-info-heading"><span class="company-avatar">${escapeHtml(String(selected.company_name || "C").trim().charAt(0).toUpperCase())}</span><div><h3>${escapeHtml(selected.company_name)}</h3><p>Participating company</p></div></div><div class="company-info-section"><h4>Company overview</h4><p>${escapeHtml(description)}</p></div><div class="company-info-section"><h4>Minimum requirements</h4><p>GPA ${Number(selected.min_gpa).toFixed(2)} · Study year ${Number(selected.min_study_year)}+</p></div><div class="company-info-section"><h4>Role fit</h4><span class="status-pill ${statusClass(selected.qualification_status)}">${selected.qualification_status === "Qualified" ? "Meets minimums" : "Review requirements"}</span></div><button type="button" class="primary-button wide apply-button" data-id="${selected.internship_id}">Apply now</button></section></aside></section>`;
  $("#back-to-opportunities").onclick = () => {
    state.selectedOpportunityId = null;
    studentOverview();
  };
  document.querySelectorAll(".detail-role-option").forEach((button) => {
    button.onclick = () => {
      state.selectedOpportunityId = Number(button.dataset.id);
      studentOverview();
    };
  });
  bindApplyButtons();
}
async function studentMatches() {
  await loadStudentData();
  pageHeader("Student workspace", "Opportunities");
  const openMatches = state.matches.filter((m) => !m.has_applied && !m.application_id);
  $("#page-content").innerHTML =
    `<section class="panel-card"><div class="panel-heading"><div><h2>Open opportunities</h2><p>Applied roles move to Analytics, where you can follow progress and review your fit feedback.</p></div></div><div class="opportunity-grid">${openMatches.length ? openMatches.map(opportunityCard).join("") : empty("You have applied to every available opportunity. Check Analytics for updates.")}</div></section>`;
  bindApplyButtons();
}
async function studentApplications() {
  await loadStudentData();
  pageHeader("Student workspace", "My applications");
  $("#page-content").innerHTML =
    `<section class="panel-card"><div class="panel-heading"><div><h2>Application tracker</h2><p>Follow every application from submission to decision.</p></div></div>${state.applications.length ? `<div class="table-wrap"><table><thead><tr><th>Internship</th><th>Company</th><th>Score</th><th>Applied</th><th>Status</th></tr></thead><tbody>${state.applications.map((a) => `<tr><td>${escapeHtml(a.title)}</td><td>${escapeHtml(a.company_name)}</td><td>${Number(a.match_score).toFixed(0)}</td><td>${escapeHtml(a.application_date)}</td><td><span class="status-pill status-pending">${escapeHtml(a.status)}</span></td></tr>`).join("")}</tbody></table></div>` : empty("You have not submitted an application yet.")}</section>`;
}
async function studentProfile() {
  await loadStudentData();
  const d = state.profile;
  pageHeader("Student workspace", "My profile");
  $("#page-content").innerHTML =
    `<div class="page-grid"><section class="panel-card half"><div class="panel-heading"><div><h2>Personal details</h2><p>Keep your student identity current.</p></div></div><form id="personal-form" class="form-grid"><label>First name<input name="firstName" required value="${escapeHtml(d.profile.first_name)}"></label><label>Last name<input name="lastName" required value="${escapeHtml(d.profile.last_name)}"></label><label class="full">Email<input disabled value="${escapeHtml(d.profile.email)}"></label><div class="form-actions full"><button class="primary-button">Save details</button></div></form></section><section class="panel-card half"><div class="panel-heading"><div><h2>Education</h2><p>Current education supplies matching GPA and study year.</p></div></div><div class="card-list">${d.education.map((e) => `<div class="list-card"><div class="list-head"><div><strong>${escapeHtml(e.degree)}</strong><p class="match-subtitle">${escapeHtml(e.institution)} · GPA ${e.gpa} · Year ${e.study_year}</p></div>${e.is_current ? '<span class="status-pill status-qualified">Current</span>' : ""}</div></div>`).join("") || empty("Add your education record.")}</div><form id="education-form" class="form-grid" style="margin-top:16px"><label>Education<select name="educationId" required>${d.education.length ? d.education.map((e) => `<option value="${e.education_id}">${escapeHtml(e.institution)} — ${escapeHtml(e.degree)}</option>`).join("") : state.education.map((e) => `<option value="${e.education_id}">${escapeHtml(e.institution)} — ${escapeHtml(e.degree)}</option>`).join("")}</select></label><label>GPA<input name="gpa" type="number" min="0" max="4" step="0.01" required></label><label>Study year<input name="studyYear" type="number" min="1" max="10" required></label><label>Graduation year<input name="graduationYear" type="number" min="2020" max="2100"></label><label class="full"><span><input name="isCurrent" type="checkbox" value="true" checked> Set as current education</span></label><div class="form-actions full"><button class="primary-button">Save education</button></div></form></section><section class="panel-card"><div class="panel-heading"><div><h2>Skills</h2><p>Skills are compared with internship requirements.</p></div></div><div class="card-list">${d.skills.map((s) => `<div class="skill-row"><div><strong>${escapeHtml(s.skill_name)}</strong><div class="skill-meta">${escapeHtml(s.category || "General")} · proficiency ${s.proficiency_level}/5 · ${s.years_experience} years</div></div><button class="danger-button remove-skill" data-id="${s.skill_id}">Remove</button></div>`).join("") || empty("Add your skills below.")}</div><form id="skill-form" class="inline-form" style="margin-top:16px"><label>Skill<select name="skillId" required>${state.skills.map((s) => `<option value="${s.skill_id}">${escapeHtml(s.skill_name)}</option>`).join("")}</select></label><label>Level<input name="proficiencyLevel" type="number" min="1" max="5" required></label><label>Years<input name="yearsExperience" type="number" min="0" max="99" step="0.5" required></label><button class="primary-button">Add skill</button></form></section><section class="panel-card half"><div class="panel-heading"><div><h2>Projects</h2><p>Show evidence of work and collaboration.</p></div></div><div class="card-list">${d.projects.map((p) => `<div class="list-card"><strong>${escapeHtml(p.project_name)}</strong><p class="match-subtitle">${escapeHtml(p.project_role)} · ${escapeHtml(p.technologies || "Technology details not provided")}</p></div>`).join("") || empty("Add a project below.")}</div><form id="project-form" class="form-grid" style="margin-top:16px"><label>Project name<input name="projectName" required></label><label>My role<input name="projectRole" required></label><label class="full">Technologies<input name="technologies"></label><label class="full">Description<textarea name="description"></textarea></label><div class="form-actions full"><button class="primary-button">Add project</button></div></form></section><section class="panel-card half"><div class="panel-heading"><div><h2>Certifications</h2><p>Keep your evidence visible.</p></div></div><div class="card-list">${d.certifications.map((c) => `<div class="list-card"><strong>${escapeHtml(c.certification_name)}</strong><p class="match-subtitle">${escapeHtml(c.issuer)} · issued ${escapeHtml(c.issue_date)}</p></div>`).join("") || empty("Add a certification below.")}</div><form id="cert-form" class="form-grid" style="margin-top:16px"><label>Certification<select name="certificationId" required>${state.certifications.map((c) => `<option value="${c.certification_id}">${escapeHtml(c.certification_name)}</option>`).join("")}</select></label><label>Issue date<input name="issueDate" type="date" required></label><div class="form-actions full"><button class="primary-button">Add certification</button></div></form></section></div>`;
  $("#personal-form").onsubmit = async (e) => {
    e.preventDefault();
    await saveForm("/api/student/profile", "PUT", e.currentTarget);
  };
  $("#education-form").onsubmit = async (e) => {
    e.preventDefault();
    await saveForm("/api/student/education", "POST", e.currentTarget);
  };
  $("#skill-form").onsubmit = async (e) => {
    e.preventDefault();
    await saveForm("/api/student/skills", "POST", e.currentTarget);
  };
  $("#project-form").onsubmit = async (e) => {
    e.preventDefault();
    await saveForm("/api/student/projects", "POST", e.currentTarget);
  };
  $("#cert-form").onsubmit = async (e) => {
    e.preventDefault();
    await saveForm("/api/student/certifications", "POST", e.currentTarget);
  };
  document.querySelectorAll(".remove-skill").forEach(
    (button) =>
      (button.onclick = async () => {
        await api(`/api/student/skills/${button.dataset.id}`, {
          method: "DELETE",
        });
        showToast("Skill removed.");
        await studentProfile();
      }),
  );
}
async function saveForm(url, method, form) {
  const submit = form.querySelector('button[type="submit"],button:not([type])');
  if (submit) {
    submit.disabled = true;
    submit.dataset.originalText = submit.textContent;
    submit.textContent = "Saving...";
  }
  try {
    await api(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData(form)),
    });
    showToast("Saved successfully.");
    state.cvDraft = null;
    await renderPage();
  } catch (error) {
    if (submit) {
      submit.disabled = false;
      submit.textContent = submit.dataset.originalText;
    }
    showToast(error.message);
  }
}
async function studentInsights() {
  await loadStudentData();
  pageHeader("Student workspace", "Analytics");
  const applicationCards = state.applications.map((application) => {
    const match = state.matches.find((item) => Number(item.internship_id) === Number(application.internship_id));
    const status = application.status;
    const stage = status === "Accepted" || status === "Rejected" ? 2 : status === "Under Review" ? 1 : 0;
    const outcome = status === "Accepted" ? "accepted" : status === "Rejected" ? "rejected" : "";
    const progress = `<div class="application-progress ${outcome}" aria-label="Application progress: ${escapeHtml(status)}"><div class="progress-step complete"><span>✓</span><small>Applied</small></div><i class="progress-line ${stage >= 1 ? "complete" : ""}"></i><div class="progress-step ${stage >= 1 ? "complete" : ""} ${stage === 1 ? "current" : ""}"><span>${stage >= 1 ? "✓" : "2"}</span><small>Company review</small></div><i class="progress-line ${stage >= 2 ? "complete" : ""}"></i><div class="progress-step ${stage >= 2 ? "complete" : ""} ${stage === 2 ? "current" : ""}"><span>${stage >= 2 ? "✓" : "3"}</span><small>Decision</small></div></div>`;
    const analysis = match ? matchAnalysis({ ...match, match_score: application.match_score }) : `<section class="match-analysis"><p>Match detail is unavailable for this application. Your saved score is <strong>${Number(application.match_score).toFixed(0)}%</strong>.</p></section>`;
    return `<article class="analytics-card"><div class="analytics-card-heading"><div><p class="eyebrow">${escapeHtml(application.company_name)}</p><h3>${escapeHtml(application.title)}</h3><p class="muted">Submitted ${escapeHtml(application.application_date)}</p></div><span class="status-pill ${statusClass(status)}">${escapeHtml(status)}</span></div>${progress}<p class="progress-caption">${status === "Pending" ? "Your application is submitted and waiting for the company to review it." : status === "Under Review" ? "The company is reviewing your application." : status === "Accepted" ? "The company accepted your application." : "The company has completed its review."}</p>${analysis}</article>`;
  }).join("");
  $("#page-content").innerHTML = `<section class="analytics-intro"><div><p class="eyebrow">Application center</p><h2>Your applications and match feedback</h2><p>Track each application as it moves through review. Match analytics explain how your profile compares with the role requirements.</p></div><div class="analytics-count"><strong>${state.applications.length}</strong><span>${state.applications.length === 1 ? "application" : "applications"}</span></div></section>${state.applications.length ? `<div class="analytics-list">${applicationCards}</div>` : `<section class="panel-card analytics-empty">${empty("Your application analytics will appear here after you apply to an opportunity.")}<button type="button" class="primary-button" id="browse-opportunities">Browse opportunities</button></section>`}<section class="panel-card score-guide"><div class="panel-heading"><div><h2>How the match score works</h2><p>Each applied role gets a transparent score from these components.</p></div></div><div class="details-row"><span class="detail-chip">Skills 60%</span><span class="detail-chip">GPA 20%</span><span class="detail-chip">Study year 20%</span></div><p class="muted">A missing mandatory skill sets the skills portion to zero. GPA and study-year points are shown separately so you can see where to focus.</p></section>`;
  $("#browse-opportunities")?.addEventListener("click", () => {
    state.page = "overview";
    renderShell();
    renderPage();
  });
}
async function companyOverview() {
  const report = await api("/api/company/reports");
  pageHeader("Company workspace", "Overview");
  $("#page-content").innerHTML =
    `<section class="welcome-banner"><div><p class="eyebrow">Recruitment workspace</p><h2>Review applicants with confidence.</h2><p>Manage requirements, compare transparent match scores, and move applications through your process.</p></div><button class="primary-button" id="go-internships">Manage internships</button></section><div class="stats-grid"><div class="stat-card"><div class="stat-label">Internships</div><div class="stat-value">${report.summary.internships || 0}</div></div><div class="stat-card"><div class="stat-label">Applications</div><div class="stat-value">${report.summary.applications || 0}</div></div><div class="stat-card"><div class="stat-label">Under review</div><div class="stat-value">${report.summary.under_review || 0}</div></div><div class="stat-card"><div class="stat-label">Accepted</div><div class="stat-value">${report.summary.accepted || 0}</div></div></div><div class="page-grid"><section class="panel-card"><div class="panel-heading"><div><h2>Top applicants</h2><p>Highest stored match scores across your internships.</p></div></div>${report.topApplicants.length ? `<div class="table-wrap"><table><thead><tr><th>Internship</th><th>Student</th><th>Score</th><th>Status</th></tr></thead><tbody>${report.topApplicants.map((a) => `<tr><td>${escapeHtml(a.title)}</td><td>${escapeHtml(a.student_name)}</td><td>${Number(a.match_score).toFixed(0)}</td><td>${escapeHtml(a.status)}</td></tr>`).join("")}</tbody></table></div>` : empty("No applications yet.")}</section></div>`;
  $("#go-internships").onclick = () => {
    state.page = "internships";
    renderShell();
    renderPage();
  };
}
async function companyInternships() {
  await loadCompanyData();
  const skills = await api("/api/catalog/skills");
  pageHeader("Company workspace", "Internships");
  $("#page-content").innerHTML =
    `<section class="panel-card"><div class="panel-heading"><div><h2>Create an internship</h2><p>Every internship should receive skill requirements before review.</p></div></div><form id="internship-form" class="form-grid"><label>Title<input name="title" required placeholder="Junior Web Developer Intern"></label><label>Minimum GPA<input name="minGpa" type="number" min="0" max="4" step="0.01" required value="3"></label><label>Minimum study year<input name="minStudyYear" type="number" min="1" max="10" required value="2"></label><div class="form-actions full"><button class="primary-button">Create internship</button></div></form></section><section class="panel-card" style="margin-top:18px"><div class="panel-heading"><div><h2>Your internships</h2><p>Configure skill requirements and review applications.</p></div></div><div class="card-list">${state.companyInternships.map((i) => `<article class="internship-card"><div class="match-head"><div><h3>${escapeHtml(i.title)}</h3><p class="match-subtitle">Minimum GPA ${i.min_gpa} · Study year ${i.min_study_year} · ${i.application_count} applications</p></div><button class="secondary-button view-applicants" data-id="${i.internship_id}">View applicants</button></div><div class="details-row">${i.skills.map((s) => `<span class="detail-chip">${escapeHtml(s.skill_name)} · ${s.is_mandatory ? "Mandatory" : "Optional"} · level ${s.minimum_proficiency}</span>`).join("") || '<span class="muted">No skill requirements added yet.</span>'}</div><form class="inline-form requirement-form" data-id="${i.internship_id}" style="margin-top:14px"><label>Skill<select name="skillId">${skills.map((s) => `<option value="${s.skill_id}">${escapeHtml(s.skill_name)}</option>`).join("")}</select></label><label>Level<input name="minimumProficiency" type="number" min="1" max="5" value="3" required></label><label>Years<input name="requiredYears" type="number" min="0" step="0.5" value="0" required></label><button class="primary-button">Add requirement</button><label><span><input name="isMandatory" type="checkbox" value="true"> Mandatory</span></label></form></article>`).join("") || empty("Create your first internship.")}</div></section>`;
  $("#internship-form").onsubmit = async (e) => {
    e.preventDefault();
    await saveForm("/api/company/internships", "POST", e.currentTarget);
  };
  document.querySelectorAll(".requirement-form").forEach(
    (form) =>
      (form.onsubmit = async (e) => {
        e.preventDefault();
        await saveForm(
          `/api/company/internships/${form.dataset.id}/skills`,
          "POST",
          form,
        );
      }),
  );
  document.querySelectorAll(".view-applicants").forEach(
    (button) =>
      (button.onclick = () => {
        state.selectedInternship = Number(button.dataset.id);
        state.page = "applicants";
        renderShell();
        renderPage();
      }),
  );
}
function statusOptions(current) {
  return ["Pending", "Under Review", "Accepted", "Rejected"]
    .map((s) => `<option ${s === current ? "selected" : ""}>${s}</option>`)
    .join("");
}
async function companyApplicants() {
  await loadCompanyData();
  pageHeader("Company workspace", "Applicants");
  if (!state.selectedInternship && state.companyInternships[0])
    state.selectedInternship = state.companyInternships[0].internship_id;
  const applications = state.selectedInternship
    ? await api(
        `/api/company/internships/${state.selectedInternship}/applications`,
      )
    : [];
  $("#page-content").innerHTML =
    `<section class="panel-card"><div class="panel-heading"><div><h2>Applicant review</h2><p>Use match score as a transparent starting point for review.</p></div><select id="applicant-internship">${state.companyInternships.map((i) => `<option value="${i.internship_id}" ${i.internship_id === state.selectedInternship ? "selected" : ""}>${escapeHtml(i.title)}</option>`).join("")}</select></div>${applications.length ? `<div class="table-wrap"><table><thead><tr><th>Student</th><th>Email</th><th>Score</th><th>Applied</th><th>Status</th></tr></thead><tbody>${applications.map((a) => `<tr><td>${escapeHtml(a.first_name)} ${escapeHtml(a.last_name)}</td><td>${escapeHtml(a.email)}</td><td>${Number(a.match_score).toFixed(0)}</td><td>${escapeHtml(a.application_date)}</td><td><select class="application-status" data-id="${a.application_id}">${statusOptions(a.status)}</select></td></tr>`).join("")}</tbody></table></div>` : empty("No applications for this internship yet.")}</section>`;
  $("#applicant-internship").onchange = (e) => {
    state.selectedInternship = Number(e.target.value);
    renderPage();
  };
  document.querySelectorAll(".application-status").forEach(
    (select) =>
      (select.onchange = async () => {
        try {
          await api(`/api/company/applications/${select.dataset.id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: select.value }),
          });
          showToast("Application status updated.");
        } catch (error) {
          showToast(error.message);
        }
      }),
  );
}
async function companyProfile() {
  const profile = await api("/api/company/profile");
  pageHeader("Company workspace", "Company profile");
  $("#page-content").innerHTML =
    `<section class="panel-card"><div class="panel-heading"><div><h2>Company details</h2><p>These details appear alongside your opportunities.</p></div></div><form id="company-profile-form" class="form-grid"><label>Company name<input name="companyName" required value="${escapeHtml(profile.company_name)}"></label><label>Email<input disabled value="${escapeHtml(profile.email)}"></label><label class="full">Description<textarea name="description">${escapeHtml(profile.description || "")}</textarea></label><div class="form-actions full"><button class="primary-button">Save profile</button></div></form></section>`;
  $("#company-profile-form").onsubmit = async (e) => {
    e.preventDefault();
    await saveForm("/api/company/profile", "PUT", e.currentTarget);
  };
}
async function companyReports() {
  const report = await api("/api/company/reports");
  pageHeader("Company workspace", "Reports");
  $("#page-content").innerHTML =
    `<div class="stats-grid"><div class="stat-card"><div class="stat-label">Pending</div><div class="stat-value">${report.summary.pending || 0}</div></div><div class="stat-card"><div class="stat-label">Under review</div><div class="stat-value">${report.summary.under_review || 0}</div></div><div class="stat-card"><div class="stat-label">Accepted</div><div class="stat-value">${report.summary.accepted || 0}</div></div><div class="stat-card"><div class="stat-label">Rejected</div><div class="stat-value">${report.summary.rejected || 0}</div></div></div><div class="page-grid"><section class="panel-card"><div class="panel-heading"><div><h2>Application pipeline</h2><p>Use this summary in the recruitment review.</p></div></div>${report.topApplicants.length ? `<div class="table-wrap"><table><thead><tr><th>Internship</th><th>Student</th><th>Score</th><th>Status</th></tr></thead><tbody>${report.topApplicants.map((a) => `<tr><td>${escapeHtml(a.title)}</td><td>${escapeHtml(a.student_name)}</td><td>${Number(a.match_score).toFixed(0)}</td><td>${escapeHtml(a.status)}</td></tr>`).join("")}</tbody></table></div>` : empty("No applications to report yet.")}</section></div>`;
}
function cvMarkup(data, draft = {}) {
  const profile = { ...data.profile, ...(draft.profile || {}) };
  const education = [...(data.education || [])]; if (draft.pendingEducation) education.unshift(draft.pendingEducation);
  const skills = [...(data.skills || [])]; if (draft.pendingSkill) skills.unshift(draft.pendingSkill);
  const projects = [...(data.projects || [])]; if (draft.pendingProject) projects.unshift(draft.pendingProject);
  const certifications = [...(data.certifications || [])]; if (draft.pendingCertification) certifications.unshift(draft.pendingCertification);
  const experience = [...(data.experience || [])]; if (draft.pendingExperience) experience.unshift(draft.pendingExperience);
  const current = education.find((item) => item.is_current) || education[0];
  const skillItems = skills.map((item) => `<span class='cv-skill-chip'>${escapeHtml(item.skill_name)}${item.proficiency_level ? ` · ${escapeHtml(item.proficiency_level)}/5` : ''}</span>`).join('');
  return `<article class='cv-paper'><header class='cv-paper-header'><div><p class='cv-kicker'>CURRICULUM VITAE</p><h2>${escapeHtml(`${profile.first_name || 'Your'} ${profile.last_name || 'Name'}`)}</h2><p class='cv-paper-role'>${escapeHtml(current?.degree || 'Student profile')}</p></div><div class='cv-contact'>${escapeHtml(profile.email || 'Add your email')}${current?.institution ? `<br>${escapeHtml(current.institution)}` : ''}</div></header><section class='cv-paper-section'><h3>Profile</h3><p>${skills.length ? `Skills include ${skills.slice(0, 4).map((item) => escapeHtml(item.skill_name)).join(', ')}.` : 'Add skills and experience to build your introduction.'}</p></section><section class='cv-paper-section'><h3>Education</h3>${education.length ? education.map((item) => `<div class='cv-entry'><div><strong>${escapeHtml(item.degree || 'Education')}</strong><p>${escapeHtml(item.institution || 'Institution')}${item.is_current ? ' · Current' : ''}</p></div><span>${item.gpa ? `GPA ${escapeHtml(item.gpa)}` : ''}${item.study_year ? ` · Year ${escapeHtml(item.study_year)}` : ''}</span></div>`).join('') : `<p class='cv-empty-copy'>Your education will appear here.</p>`}</section><section class='cv-paper-section'><h3>Skills</h3><div class='cv-skill-list'>${skillItems || `<p class='cv-empty-copy'>Your skills will appear here.</p>`}</div></section><section class='cv-paper-section'><h3>Projects</h3>${projects.length ? projects.map((item) => `<div class='cv-entry cv-entry-block'><div><strong>${escapeHtml(item.project_name)}</strong><p>${escapeHtml(item.project_role)}${item.technologies ? ` · ${escapeHtml(item.technologies)}` : ''}</p></div></div>`).join('') : `<p class='cv-empty-copy'>Add projects to show practical experience.</p>`}</section>${experience.length ? `<section class='cv-paper-section'><h3>Experience</h3>${experience.map((item) => `<div class='cv-entry'><div><strong>${escapeHtml(item.position_title)}</strong><p>${escapeHtml(item.organization)}${item.role ? ` · ${escapeHtml(item.role)}` : ''}</p></div><span>${item.duration_months ? `${escapeHtml(item.duration_months)} months` : ''}</span></div>`).join('')}</section>` : ''}${certifications.length ? `<section class='cv-paper-section'><h3>Certifications</h3>${certifications.map((item) => `<div class='cv-entry cv-entry-block'><div><strong>${escapeHtml(item.certification_name)}</strong><p>${escapeHtml(item.issuer)}</p></div></div>`).join('')}</section>` : ''}</article>`;
}
function cvDraftFromForm(data, tab, form) {
  const draft = state.cvDraft || {};
  const values = Object.fromEntries(new FormData(form).entries());
  if (tab === 'personal') draft.profile = { first_name: values.firstName || data.profile.first_name, last_name: values.lastName || data.profile.last_name };
  if (tab === 'education' && values.gpa) { const row = state.education.find((item) => String(item.education_id) === values.educationId) || {}; draft.pendingEducation = { degree: values.degree || row.degree || 'Education', institution: values.institution || row.institution || 'Institution', gpa: values.gpa, study_year: values.studyYear, is_current: values.isCurrent === 'true' }; }
  if (tab === 'skills' && (values.skillId || values.skillName)) { const row = state.skills.find((item) => String(item.skill_id) === values.skillId) || {}; draft.pendingSkill = { skill_name: values.skillName || row.skill_name || 'Skill', proficiency_level: values.proficiencyLevel }; }
  if (tab === 'projects' && (values.projectName || values.projectCode)) { const row = data.projects.find((item) => item.project_code === values.projectCode) || {}; draft.pendingProject = { project_name: values.projectName || row.project_name || 'Project', project_role: values.projectRole, technologies: values.technologies || row.technologies }; }
  if (tab === 'certifications' && (values.certificationId || values.certificationName)) { const row = state.certifications.find((item) => String(item.certification_id) === values.certificationId) || {}; draft.pendingCertification = { certification_name: values.certificationName || row.certification_name || 'Certification', issuer: values.issuer || row.issuer || '' }; }
  if (tab === 'experience' && values.positionTitle) { const row = state.experienceCatalog.find((item) => String(item.experience_id) === values.experienceId) || {}; draft.pendingExperience = { position_title: values.positionTitle, organization: row.organization || 'Organization', role: values.role, duration_months: values.durationMonths }; }
  state.cvDraft = draft;
  return draft;
}
function profileSection(tab, d) {
  if (tab === "personal")
    return `<section class="profile-panel" aria-labelledby="personal-heading"><div class="panel-heading"><div><h2 id="personal-heading">Personal information</h2><p>Keep the details used to identify you current.</p></div></div><form id="personal-form" class="form-grid"><label>First name<input name="firstName" autocomplete="given-name" required value="${escapeHtml(d.profile.first_name)}"></label><label>Last name<input name="lastName" autocomplete="family-name" required value="${escapeHtml(d.profile.last_name)}"></label><label class="full">Email<input disabled value="${escapeHtml(d.profile.email)}"></label><div class="form-actions full"><button class="primary-button">Save personal information</button></div></form></section>`;
  if (tab === "education")
    return `<section class="profile-panel" aria-labelledby="education-heading"><div class="panel-heading"><div><h2 id="education-heading">Education</h2><p>Your current education supplies the GPA and study-year parts of matching.</p></div></div><div class="profile-list">${d.education.map((e) => `<div class="profile-item"><div><strong>${escapeHtml(e.degree)}</strong><p>${escapeHtml(e.institution)} · GPA ${e.gpa} · Year ${e.study_year}${e.is_current ? " · Current" : ""}</p></div><button type="button" class="danger-button remove-profile-item" data-url="/api/student/education/${e.education_id}" data-label="education record">Remove</button></div>`).join("") || empty("No education records yet.")}</div><form id="education-form" class="form-grid add-form"><label>Education<select name="educationId" required>${state.education.map((e) => `<option value="${e.education_id}">${escapeHtml(e.institution)} — ${escapeHtml(e.degree)}</option>`).join("")}</select></label><label>GPA<input name="gpa" type="number" min="0" max="4" step="0.01" required placeholder="3.50"></label><label>Study year<input name="studyYear" type="number" min="1" max="10" required placeholder="3"></label><label>Graduation year<input name="graduationYear" type="number" min="2020" max="2100" placeholder="2027"></label><label class="full check-line"><input name="isCurrent" type="checkbox" value="true" checked> Set as current education</label><div class="form-actions full"><button class="primary-button">Add education</button></div></form></section>`;
  if (tab === "skills")
    return `<section class="profile-panel" aria-labelledby="skills-heading"><div class="panel-heading"><div><h2 id="skills-heading">Skills</h2><p>Skills are compared with internship requirements and affect your match score.</p></div></div><div class="profile-list">${d.skills.map((s) => `<div class="profile-item"><div><strong>${escapeHtml(s.skill_name)}</strong><p>${escapeHtml(s.category || "General")} · Proficiency ${s.proficiency_level}/5 · ${s.years_experience} years experience</p></div><button type="button" class="danger-button remove-profile-item" data-url="/api/student/skills/${s.skill_id}" data-label="skill">Remove</button></div>`).join("") || empty("No skills added yet.")}</div><form id="skill-form" class="form-grid add-form"><label>Skill<select name="skillId" required>${state.skills.map((s) => `<option value="${s.skill_id}">${escapeHtml(s.skill_name)}</option>`).join("")}</select></label><label>Proficiency level<input name="proficiencyLevel" type="number" min="1" max="5" required placeholder="1 to 5"></label><label>Years of experience<input name="yearsExperience" type="number" min="0" max="99" step="0.5" required placeholder="0"></label><div class="form-actions full"><button class="primary-button">Add skill</button></div></form></section>`;
  if (tab === "projects")
    return `<section class="profile-panel" aria-labelledby="projects-heading"><div class="panel-heading"><div><h2 id="projects-heading">Projects</h2><p>Show evidence of your work, responsibilities, and technologies.</p></div></div><div class="profile-list">${d.projects.map((p) => `<div class="profile-item"><div><strong>${escapeHtml(p.project_name)}</strong><p>${escapeHtml(p.project_role)} · ${escapeHtml(p.technologies || "Technologies not provided")}</p></div><button type="button" class="danger-button remove-profile-item" data-url="/api/student/projects/${p.project_id}" data-label="project">Remove</button></div>`).join("") || empty("No projects added yet.")}</div><form id="project-form" class="form-grid add-form"><label>Project name<input name="projectName" required placeholder="SmartIntern"></label><label>My role<input name="projectRole" required placeholder="Database designer"></label><label class="full">Technologies<input name="technologies" placeholder="MySQL, JavaScript"></label><label class="full">Description<textarea name="description" placeholder="Briefly describe what you contributed."></textarea></label><div class="form-actions full"><button class="primary-button">Add project</button></div></form></section>`;
  if (tab === "certifications")
    return `<section class="profile-panel" aria-labelledby="certifications-heading"><div class="panel-heading"><div><h2 id="certifications-heading">Certifications</h2><p>Keep professional certificates and issue dates available for review.</p></div></div><div class="profile-list">${d.certifications.map((c) => `<div class="profile-item"><div><strong>${escapeHtml(c.certification_name)}</strong><p>${escapeHtml(c.issuer)} · Issued ${escapeHtml(c.issue_date)}</p></div><button type="button" class="danger-button remove-profile-item" data-url="/api/student/certifications/${c.certification_id}" data-label="certification">Remove</button></div>`).join("") || empty("No certifications added yet.")}</div><form id="cert-form" class="form-grid add-form"><label>Certification<select name="certificationId" required>${state.certifications.map((c) => `<option value="${c.certification_id}">${escapeHtml(c.certification_name)}</option>`).join("")}</select></label><label>Issue date<input name="issueDate" type="date" required></label><div class="form-actions full"><button class="primary-button">Add certification</button></div></form></section>`;
  return `<section class="profile-panel" aria-labelledby="experience-heading"><div class="panel-heading"><div><h2 id="experience-heading">Experience</h2><p>Record work, volunteer, or placement experience that supports your profile.</p></div></div><div class="profile-list">${(d.experience || []).map((x) => `<div class="profile-item"><div><strong>${escapeHtml(x.position_title)}</strong><p>${escapeHtml(x.organization)} · ${escapeHtml(x.role || "Role not specified")} · ${x.duration_months} months</p></div><button type="button" class="danger-button remove-profile-item" data-url="/api/student/experience/${x.experience_id}" data-label="experience record">Remove</button></div>`).join("") || empty("No experience added yet.")}</div><form id="experience-form" class="form-grid add-form"><label>Organization<input name="organization" required placeholder="Company or organization"></label><label>Position title<input name="positionTitle" required placeholder="Intern"></label><label>Role<input name="role" placeholder="What did you do?"></label><label>Duration in months<input name="durationMonths" type="number" min="0" max="600" required placeholder="6"></label><div class="form-actions full"><button class="primary-button">Add experience</button></div></form></section>`;
}
async function studentProfile() {
  await loadStudentData();
  const d = state.profile;
  const tabs = [
    ["personal", "Personal"],
    ["education", "Education"],
    ["skills", "Skills"],
    ["projects", "Projects"],
    ["certifications", "Certifications"],
    ["experience", "Experience"],
  ];
  const currentEducation =
    d.education.find((item) => item.is_current) || d.education[0];
  const completion = [
    d.profile.first_name,
    d.profile.last_name,
    d.education.length,
    d.skills.length,
    d.projects.length,
    d.certifications.length,
  ].filter(Boolean).length;
  const completionPercent = Math.round((completion / 6) * 100);
  state.profileTab = state.profileTab || "personal";
  state.profileMode = state.profileMode || 'preview';
  pageHeader("Student workspace", "My profile");
  const renderProfile = () => {
    if (state.profileMode !== 'edit') {
      $('#page-content').innerHTML = '<div class=cv-preview-actions><button type=button class=primary-button id=edit-cv>Edit CV</button></div><div id=cv-preview class=cv-preview-direct>' + cvMarkup(d, state.cvDraft || {}) + '</div>';
      $('#edit-cv').onclick = () => { state.profileMode = 'edit'; renderProfile(); };
      return;
    }
    const active = tabs.some(([id]) => id === state.profileTab)
      ? state.profileTab
      : "personal";
    state.profileTab = active;
    $("#page-content").innerHTML =
      `<section class="profile-summary"><div><p class="eyebrow">Your profile</p><h2>${escapeHtml(d.profile.first_name)} ${escapeHtml(d.profile.last_name)}</h2><p>Keep your evidence current to receive more accurate internship matches.</p></div><div class="completion-card"><strong>${completionPercent}%</strong><span>profile complete</span><div class="completion-track"><span style="width:${completionPercent}%"></span></div></div></section><div class="profile-stat-grid"><div><span>Current GPA</span><strong>${currentEducation?.gpa ?? "Not set"}</strong></div><div><span>Study year</span><strong>${currentEducation?.study_year ?? "Not set"}</strong></div><div><span>Skills</span><strong>${d.skills.length}</strong></div><div><span>Projects</span><strong>${d.projects.length}</strong></div></div><section class="profile-workspace"><div class="profile-tabs" role="tablist" aria-label="Profile sections">${tabs.map(([id, label]) => `<button type="button" role="tab" class="profile-tab ${active === id ? "active" : ""}" aria-selected="${active === id}" aria-controls="profile-panel" data-profile-tab="${id}">${label}</button>`).join("")}</div><div id="profile-panel" role="tabpanel" tabindex="-1">${profileSection(active, d)}</div></section>`;
    $('#page-content').classList.add('cv-edit-mode');
    $('#page-content').insertAdjacentHTML('afterbegin', '<section class=cv-editor-heading><div><p class=eyebrow>Build your profile</p><h2>Edit your CV</h2><p>Update a section and see the preview change alongside the form.</p></div><button type=button class=secondary-button id=view-cv>View CV</button></section>');
    const workspace = document.querySelector('.profile-workspace');
    workspace.classList.add('cv-editor-layout');
    workspace.insertAdjacentHTML('beforeend', '<aside class=cv-live-panel><div id=cv-live-preview class=cv-preview-direct>' + cvMarkup(d, state.cvDraft || {}) + '</div></aside>');
    $('#view-cv').onclick = () => { state.profileMode = 'preview'; state.cvDraft = null; renderProfile(); };
    document.querySelectorAll("[data-profile-tab]").forEach(
      (button) =>
        (button.onclick = () => {
          state.profileTab = button.dataset.profileTab;
          renderProfile();
          document.querySelector(".profile-tab.active").focus();
        }),
    );
    const forms = [
      ["personal-form", "/api/student/profile", "PUT"],
      ["education-form", "/api/student/education", "POST"],
      ["skill-form", "/api/student/skills", "POST"],
      ["project-form", "/api/student/projects", "POST"],
      ["cert-form", "/api/student/certifications", "POST"],
      ["experience-form", "/api/student/experience", "POST"],
    ];
    forms.forEach(([id, url, method]) => {
      const form = $(`#${id}`);
      if (form)
        form.onsubmit = async (e) => {
          e.preventDefault();
          await saveForm(url, method, e.currentTarget);
        };
      if (form) {
        const refresh = () => { const preview = $('#cv-live-preview'); if (preview) preview.innerHTML = cvMarkup(d, cvDraftFromForm(d, active, form)); };
        form.addEventListener('input', refresh);
        form.addEventListener('change', refresh);
      }
    });
    const joinProjectForm = $('#project-join-form');
    if (joinProjectForm) {
      const refresh = () => { const preview = $('#cv-live-preview'); if (preview) preview.innerHTML = cvMarkup(d, cvDraftFromForm(d, active, joinProjectForm)); };
      joinProjectForm.addEventListener('input', refresh);
      joinProjectForm.addEventListener('change', refresh);
    }
    document.querySelectorAll(".remove-profile-item").forEach(
      (button) =>
        (button.onclick = async () => {
          if (!window.confirm(`Remove this ${button.dataset.label}?`)) return;
          button.disabled = true;
          try {
            await api(button.dataset.url, { method: "DELETE" });
            showToast("Removed successfully.");
            await studentProfile();
          } catch (error) {
            button.disabled = false;
            showToast(error.message);
          }
        }),
    );
  };
  renderProfile();
}
const originalProfileSection = profileSection;
profileSection = function (tab, d) {
  if (tab !== "experience") return originalProfileSection(tab, d);
  return `<section class="profile-panel" aria-labelledby="experience-heading"><div class="panel-heading"><div><h2 id="experience-heading">Experience</h2><p>Choose an organization once, then record your own position, role, and duration.</p></div></div><div class="profile-list">${(d.experience || []).map((x) => `<div class="profile-item"><div><strong>${escapeHtml(x.position_title)}</strong><p>${escapeHtml(x.organization)} · ${escapeHtml(x.role || "Role not specified")} · ${x.duration_months} months</p></div><button type="button" class="danger-button remove-profile-item" data-url="/api/student/experience/${x.experience_id}" data-label="experience record">Remove</button></div>`).join("") || empty("No experience added yet.")}</div><form id="experience-form" class="form-grid add-form"><label>Organization<select name="experienceId" required>${state.experienceCatalog.map((x) => `<option value="${x.experience_id}">${escapeHtml(x.organization)}</option>`).join("")}</select></label><label>Position title<input name="positionTitle" required placeholder="Software Intern"></label><label>Role<input name="role" required placeholder="Backend developer"></label><label>Duration in months<input name="durationMonths" type="number" min="0" max="600" required placeholder="6"></label><div class="form-actions full"><button class="primary-button">Add experience</button></div></form></section>`;
};
const catalogProfileSection = profileSection;
profileSection = function (tab, d) {
  if (tab !== "skills" && tab !== "projects")
    return catalogProfileSection(tab, d);
  if (tab === "skills")
    return `<section class="profile-panel" aria-labelledby="skills-heading"><div class="panel-heading"><div><h2 id="skills-heading">Skills</h2><p>Use an existing skill or add a new skill to the shared catalog.</p></div></div><div class="profile-list">${d.skills.map((s) => `<div class="profile-item"><div><strong>${escapeHtml(s.skill_name)}</strong><p>${escapeHtml(s.category || "General")} · Proficiency ${s.proficiency_level}/5 · ${s.years_experience} years experience</p></div><button type="button" class="danger-button remove-profile-item" data-url="/api/student/skills/${s.skill_id}" data-label="skill">Remove</button></div>`).join("") || empty("No skills added yet.")}</div><form id="skill-form" class="form-grid add-form"><label>Skill name<input name="skillName" required placeholder="Python"></label><label>Category<input name="category" placeholder="Programming"></label><label>Proficiency level<input name="proficiencyLevel" type="number" min="1" max="5" required placeholder="1 to 5"></label><label>Years of experience<input name="yearsExperience" type="number" min="0" max="99" step="0.5" required placeholder="0"></label><div class="form-actions full"><button class="primary-button">Add skill</button></div></form></section>`;
  return `<section class="profile-panel" aria-labelledby="projects-heading"><div class="panel-heading"><div><h2 id="projects-heading">Projects</h2><p>Create a project once and share its code with teammates. Each student keeps their own role.</p></div></div><div class="profile-list">${d.projects.map((p) => `<div class="profile-item"><div><strong>${escapeHtml(p.project_name)}</strong><p>Code: ${escapeHtml(p.project_code)} · My role: ${escapeHtml(p.project_role)} · ${escapeHtml(p.technologies || "Technologies not provided")}</p></div><button type="button" class="danger-button remove-profile-item" data-url="/api/student/projects/${p.project_id}" data-label="project connection">Remove</button></div>`).join("") || empty("No projects connected yet.")}</div><div class="project-actions"><form id="project-form" class="form-grid add-form"><h3 class="full">Create a project</h3><label>Project name<input name="projectName" required placeholder="SmartIntern"></label><label>My role<input name="projectRole" required placeholder="Database designer"></label><label class="full">Technologies<input name="technologies" placeholder="MySQL, JavaScript"></label><label class="full">Description<textarea name="description" placeholder="Briefly describe the project."></textarea></label><div class="form-actions full"><button class="primary-button">Create project</button></div></form><form id="project-join-form" class="form-grid add-form"><h3 class="full">Join a teammate's project</h3><label>Project code<input name="projectCode" required placeholder="PRJ-0001" autocapitalize="characters"></label><label>My role<input name="projectRole" required placeholder="Frontend developer"></label><div class="form-actions full"><button class="secondary-button">Join project</button></div></form></div></section>`;
};
const relationshipProfileSection = profileSection;
profileSection = function (tab, d) {
  if (tab !== "education" && tab !== "certifications")
    return relationshipProfileSection(tab, d);
  if (tab === "education")
    return `<section class="profile-panel" aria-labelledby="education-heading"><div class="panel-heading"><div><h2 id="education-heading">Education</h2><p>Select an existing institution and degree, or add a new catalog record if it is not listed.</p></div></div><div class="profile-list">${d.education.map((e) => `<div class="profile-item"><div><strong>${escapeHtml(e.degree)}</strong><p>${escapeHtml(e.institution)} · GPA ${e.gpa} · Year ${e.study_year}${e.is_current ? " · Current" : ""}</p></div><button type="button" class="danger-button remove-profile-item" data-url="/api/student/education/${e.education_id}" data-label="education record">Remove</button></div>`).join("") || empty("No education records yet.")}</div><form id="education-form" class="form-grid add-form"><h3 class="full">Use an existing education record</h3><label class="full">Select institution and degree<select name="educationId"><option value="">Add a new record instead</option>${state.education.map((e) => `<option value="${e.education_id}">${escapeHtml(e.institution)} — ${escapeHtml(e.degree)}</option>`).join("")}</select></label><h3 class="full form-subheading">New record details</h3><label>Institution<input name="institution" placeholder="University name"></label><label>Degree<input name="degree" placeholder="Computer Science"></label><label>GPA<input name="gpa" type="number" min="0" max="4" step="0.01" required placeholder="3.50"></label><label>Study year<input name="studyYear" type="number" min="1" max="10" required placeholder="3"></label><label>Graduation year<input name="graduationYear" type="number" min="2020" max="2100" placeholder="2027"></label><label class="full check-line"><input name="isCurrent" type="checkbox" value="true" checked> Set as current education</label><div class="form-actions full"><button class="primary-button">Save education</button></div></form></section>`;
  return `<section class="profile-panel" aria-labelledby="certifications-heading"><div class="panel-heading"><div><h2 id="certifications-heading">Certifications</h2><p>Select an existing certification, or add a new catalog record if it is not listed.</p></div></div><div class="profile-list">${d.certifications.map((c) => `<div class="profile-item"><div><strong>${escapeHtml(c.certification_name)}</strong><p>${escapeHtml(c.issuer)} · Issued ${escapeHtml(c.issue_date)}</p></div><button type="button" class="danger-button remove-profile-item" data-url="/api/student/certifications/${c.certification_id}" data-label="certification">Remove</button></div>`).join("") || empty("No certifications added yet.")}</div><form id="cert-form" class="form-grid add-form"><h3 class="full">Use an existing certification</h3><label class="full">Select certification and issuer<select name="certificationId"><option value="">Add a new record instead</option>${state.certifications.map((c) => `<option value="${c.certification_id}">${escapeHtml(c.certification_name)} — ${escapeHtml(c.issuer)}</option>`).join("")}</select></label><h3 class="full form-subheading">New record details</h3><label>Certification name<input name="certificationName" placeholder="AWS Cloud Practitioner"></label><label>Issuer<input name="issuer" placeholder="Amazon"></label><label>Issue date<input name="issueDate" type="date" required></label><div class="form-actions full"><button class="primary-button">Save certification</button></div></form></section>`;
};
document.addEventListener("submit", async (event) => {
  if (event.target.id !== "project-join-form") return;
  event.preventDefault();
  await saveForm("/api/student/projects/join", "POST", event.target);
});
async function renderPage() {
  try {
    if (state.user.role === "Student") {
      if (state.page === "matches") return studentMatches();
      if (state.page === "applications") return studentApplications();
      if (state.page === "profile") return studentProfile();
      if (state.page === "insights") return studentInsights();
      return studentOverview();
    }
    if (state.page === "internships") return companyInternships();
    if (state.page === "applicants") return companyApplicants();
    if (state.page === "company-profile") return companyProfile();
    if (state.page === "reports") return companyReports();
    return companyOverview();
  } catch (error) {
    $("#page-content").innerHTML =
      `<div class="error-box">${escapeHtml(error.message)}</div>`;
  }
}
async function bootApp() {
  renderShell();
  await renderPage();
}
async function init() {
  setupLogin();
  setupLoginPreview();
  try {
    state.user = await api("/api/auth/me");
    await bootApp();
  } catch (_error) {
    $("#login-screen").classList.remove("hidden");
  }
}
init();
