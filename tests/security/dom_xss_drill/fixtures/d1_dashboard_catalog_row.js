// H5106 D1 — PR #299 pre-fix dashboard row assembly (JS mirror of build_pipeline_dashboard.py)
// input: entry
const title = JSON.parse(catalog).title;    // SOURCE: data-bearing catalog field
const row = '<tr><td>' + title + '</td><td><a href="' + entry.url + '">' + entry.name + '</a></td></tr>';
container.innerHTML += row;
