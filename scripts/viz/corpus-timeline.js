/**
 * Corpus Timeline Visualization (v5.0)
 * Modern, interactive view of Zalizniak's lectures.
 */

window.VIZ_MODULES = window.VIZ_MODULES || {};
window.VIZ_MODULES.renderCorpusTimeline = function(container, appData) {
    const lectures = appData.lectures || [];

    const html = `
        <div class="corpus-timeline">
            <header class="timeline-header">
                <h1>Хронология лекций</h1>
                <p>Десять лекций А. А. Зализняка в школе «Муми-тролль» (2005–2017)</p>
            </header>
            <div class="timeline-scroll-container">
                <div class="timeline-track"></div>
                <div class="timeline-items">
                    ${lectures.map((lecture, index) => renderLectureCard(lecture, index)).join('')}
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;

    // Add event listeners for interactivity
    container.querySelectorAll('.lecture-card').forEach(card => {
        card.addEventListener('click', () => {
            card.classList.toggle('expanded');
        });
    });
};

function renderLectureCard(lecture, index) {
    const icon = lecture.icon || '📘';
    const terms = lecture.terms || [];

    return `
        <div class="timeline-item-wrapper">
            <div class="timeline-dot"></div>
            <div class="lecture-card" data-index="${index}">
                <div class="card-header">
                    <span class="lecture-icon">${icon}</span>
                    <div class="lecture-meta">
                        <span class="lecture-pages">стр. ${lecture.pages}</span>
                        <h3 class="lecture-title">${lecture.name}</h3>
                    </div>
                </div>
                <div class="card-content">
                    <p class="main-idea">${lecture.main_idea}</p>
                    <div class="details">
                        <h4>Ключевые факты</h4>
                        <ul>
                            ${(lecture.key_facts || []).map(f => `<li>${f}</li>`).join('')}
                        </ul>
                        <div class="tags">
                            ${terms.map(t => `<span class="term-tag">${t}</span>`).join('')}
                        </div>
                    </div>
                </div>
                <div class="card-footer">
                    <button class="expand-btn">Подробнее</button>
                </div>
            </div>
        </div>
    `;
}
