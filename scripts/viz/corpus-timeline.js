/**
 * Corpus Timeline Visualization (v5.0)
 * Modern, interactive view of Zaliznyak's lectures.
 */

window.VIZ_MODULES = window.VIZ_MODULES || {};
window.VIZ_MODULES.renderCorpusTimeline = function(container, appData) {
    if (!document.getElementById('corpus-timeline-styles')) {
        const style = document.createElement('style');
        style.id = 'corpus-timeline-styles';
        style.textContent = `
            .corpus-timeline {
                font-family: 'Inter', system-ui, -apple-system, sans-serif;
                color: #e0e0e0;
                padding: 2rem;
                max-width: 1000px;
                margin: 0 auto;
                background: radial-gradient(circle at top right, rgba(103, 58, 183, 0.1), transparent),
                            radial-gradient(circle at bottom left, rgba(0, 150, 136, 0.1), transparent);
            }
            .timeline-header { text-align: center; margin-bottom: 4rem; }
            .timeline-header h1 {
                font-size: 3rem; font-weight: 800;
                background: linear-gradient(135deg, #b388ff, #80deea);
                -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                margin-bottom: 0.5rem;
            }
            .timeline-scroll-container { position: relative; padding-left: 3rem; }
            .timeline-track {
                position: absolute; left: 15px; top: 0; bottom: 0; width: 4px;
                background: linear-gradient(to bottom, #b388ff, #80deea, #b388ff);
                border-radius: 2px; opacity: 0.3;
            }
            .timeline-item-wrapper {
                position: relative; margin-bottom: 3rem; opacity: 0;
                transform: translateY(20px); animation: fadeInSlide 0.6s forwards;
                animation-delay: calc(var(--index) * 0.1s);
            }
            @keyframes fadeInSlide { to { opacity: 1; transform: translateY(0); } }
            .timeline-dot {
                position: absolute; left: -23px; top: 25px; width: 20px; height: 20px;
                background: #b388ff; border: 4px solid #1a1a1a; border-radius: 50%;
                z-index: 2; box-shadow: 0 0 15px rgba(179, 136, 255, 0.6);
            }
            .lecture-card {
                background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(12px);
                border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px;
                padding: 1.5rem; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                overflow: hidden;
            }
            .lecture-card:hover {
                background: rgba(255, 255, 255, 0.08); border-color: rgba(179, 136, 255, 0.4);
                transform: translateX(10px); box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            }
            .card-header { display: flex; align-items: center; gap: 1.5rem; }
            .lecture-icon {
                font-size: 2.5rem; background: rgba(179, 136, 255, 0.1);
                width: 60px; height: 60px; display: flex; align-items: center; justify-content: center;
                border-radius: 15px;
            }
            .lecture-pages { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; color: #80deea; }
            .lecture-title { font-size: 1.4rem; margin: 0.2rem 0; }
            .card-content { margin-top: 1rem; }
            .main-idea { font-size: 1.1rem; line-height: 1.6; color: #bbb; }
            .details { max-height: 0; opacity: 0; transition: all 0.5s ease; overflow: hidden;}
            .lecture-card.expanded .details { max-height: 800px; opacity: 1; margin-top: 1.5rem; }
            .details h4 { color: #b388ff; margin-bottom: 0.5rem; }
            .details ul { list-style: none; padding: 0; }
            .details li { margin-bottom: 0.5rem; padding-left: 1.5rem; position: relative; }
            .details li::before { content: '→'; position: absolute; left: 0; color: #80deea; }
            .tags { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1.5rem; }
            .term-tag {
                background: rgba(128, 222, 234, 0.1); border: 1px solid rgba(128, 222, 234, 0.2);
                color: #80deea; padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.85rem;
                transition: all 0.2s;
            }
            .term-tag:hover { background: rgba(128, 222, 234, 0.2); border-color: #80deea; }
            .card-footer { margin-top: 1rem; text-align: right; }
            .expand-btn { background: transparent; border: none; color: #b388ff; font-size: 0.9rem; font-weight: 600; cursor: pointer; padding: 0; }
        `;
        document.head.appendChild(style);
    }

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
        <div class="timeline-item-wrapper" style="--index: ${index}">
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
