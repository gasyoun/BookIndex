<script>
  const demoEntities = [
    { type: 'names', head: 'Зализняк А. А.', pages: 120 },
    { type: 'languages', head: 'праиндоевропейский', pages: 98 },
    { type: 'toponyms', head: 'Новгород', pages: 76 },
    { type: 'lexicon', head: 'энклитика', pages: 34 }
  ];

  let query = '';
  let selectedType = 'all';

  $: normalized = query.trim().toLowerCase();
  $: filtered = demoEntities.filter((item) => {
    const typeOk = selectedType === 'all' || item.type === selectedType;
    const textOk = !normalized || item.head.toLowerCase().includes(normalized);
    return typeOk && textOk;
  });
</script>

<main class="page">
  <header class="hero">
    <h1>BookIndex Svelte Pilot</h1>
    <p>Демо декларативного рендера списка и фильтров.</p>
  </header>

  <section class="toolbar">
    <input
      type="search"
      bind:value={query}
      placeholder="Поиск по head..."
      aria-label="Поиск"
    />
    <select bind:value={selectedType} aria-label="Тип сущности">
      <option value="all">Все типы</option>
      <option value="names">names</option>
      <option value="languages">languages</option>
      <option value="toponyms">toponyms</option>
      <option value="lexicon">lexicon</option>
    </select>
  </section>

  {#if filtered.length === 0}
    <p class="empty">Ничего не найдено по текущим фильтрам.</p>
  {:else}
    <ul class="list">
      {#each filtered as item}
        <li>
          <strong>{item.head}</strong>
          <span>{item.type}</span>
          <em>{item.pages} стр.</em>
        </li>
      {/each}
    </ul>
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    font-family: "Segoe UI", Arial, sans-serif;
    background: linear-gradient(180deg, #f6f2ea 0%, #efe6d6 100%);
    color: #2f2417;
  }

  .page {
    max-width: 860px;
    margin: 0 auto;
    padding: 24px 16px 40px;
  }

  .hero h1 {
    margin: 0 0 8px;
    font-size: 28px;
  }

  .hero p {
    margin: 0 0 18px;
    color: #6b5438;
  }

  .toolbar {
    display: grid;
    grid-template-columns: 1fr 200px;
    gap: 10px;
    margin-bottom: 14px;
  }

  .toolbar input,
  .toolbar select {
    border: 1px solid #c7b08c;
    border-radius: 10px;
    padding: 10px 12px;
    font: inherit;
    background: #fffaf1;
  }

  .list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 8px;
  }

  .list li {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 10px;
    border: 1px solid #dac7a8;
    border-radius: 10px;
    padding: 10px 12px;
    background: #fffdfa;
  }

  .list span {
    color: #735a3c;
  }

  .list em {
    color: #8d6f49;
    font-style: normal;
  }

  .empty {
    padding: 14px;
    border: 1px dashed #c7b08c;
    border-radius: 10px;
    background: #fff8ed;
    color: #7a5e3f;
  }

  @media (max-width: 680px) {
    .toolbar {
      grid-template-columns: 1fr;
    }

    .list li {
      grid-template-columns: 1fr;
    }
  }
</style>
