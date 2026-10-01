/**
 * Corpus Timeline Visualization (v5.0)
 * Modern, interactive view of Zalizniak's lectures.
 */

window.VIZ_MODULES = window.VIZ_MODULES || {};
window.VIZ_MODULES.renderCorpusTimeline = function(container, appData) {
    const lectures = appData.lectures || [];

    // C3: the shell below is static markup (no data interpolation). Lecture
    // fields (names, ideas, facts, terms) are knowledge-base data and mount
    // via DOM APIs (textContent) in renderLectureCard — never through
    // data-bearing innerHTML template joins.
    container.innerHTML = `
        <div class="corpus-timeline">
            <header class="timeline-header">
                <h1>Хронология лекций</h1>
                <p>Десять лекций А. А. Зализняка в школе «Муми-тролль» (2005–2017)</p>
            </header>
            <div class="timeline-scroll-container">
                <div class="timeline-track"></div>
                <div class="timeline-items"></div>
            </div>
        </div>
    `;

    const items = container.querySelector('.timeline-items');
    lectures.forEach((lecture, index) => {
        if (items) items.appendChild(renderLectureCard(lecture, index));
    });

    // Add event listeners for interactivity
    container.querySelectorAll('.lecture-card').forEach(card => {
        card.addEventListener('click', () => {
            card.classList.toggle('expanded');
        });
    });
};

function renderLectureCard(lecture, index) {
    const wrapper = document.createElement('div');
    wrapper.className = 'timeline-item-wrapper';

    const dot = document.createElement('div');
    dot.className = 'timeline-dot';
    wrapper.appendChild(dot);

    const card = document.createElement('div');
    card.className = 'lecture-card';
    card.dataset.index = String(index);
    wrapper.appendChild(card);

    const header = document.createElement('div');
    header.className = 'card-header';
    const icon = document.createElement('span');
    icon.className = 'lecture-icon';
    icon.textContent = String(lecture.icon || '📘');
    header.appendChild(icon);
    const meta = document.createElement('div');
    meta.className = 'lecture-meta';
    const pages = document.createElement('span');
    pages.className = 'lecture-pages';
    pages.textContent = `стр. ${String(lecture.pages == null ? '' : lecture.pages)}`;
    meta.appendChild(pages);
    const title = document.createElement('h3');
    title.className = 'lecture-title';
    title.textContent = String(lecture.name || '');
    meta.appendChild(title);
    header.appendChild(meta);
    card.appendChild(header);

    const content = document.createElement('div');
    content.className = 'card-content';
    const idea = document.createElement('p');
    idea.className = 'main-idea';
    idea.textContent = String(lecture.main_idea || '');
    content.appendChild(idea);
    const details = document.createElement('div');
    details.className = 'details';
    const factsTitle = document.createElement('h4');
    factsTitle.textContent = 'Ключевые факты';
    details.appendChild(factsTitle);
    const factsList = document.createElement('ul');
    (lecture.key_facts || []).forEach((f) => {
        const li = document.createElement('li');
        li.textContent = String(f);
        factsList.appendChild(li);
    });
    details.appendChild(factsList);
    const tags = document.createElement('div');
    tags.className = 'tags';
    (lecture.terms || []).forEach((t) => {
        const tag = document.createElement('span');
        tag.className = 'term-tag';
        tag.textContent = String(t);
        tags.appendChild(tag);
    });
    details.appendChild(tags);
    content.appendChild(details);
    card.appendChild(content);

    const footer = document.createElement('div');
    footer.className = 'card-footer';
    const expandBtn = document.createElement('button');
    expandBtn.className = 'expand-btn';
    expandBtn.textContent = 'Подробнее';
    footer.appendChild(expandBtn);
    card.appendChild(footer);

    return wrapper;
}
