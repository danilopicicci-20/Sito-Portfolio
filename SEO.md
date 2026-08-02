# SEO — cosa è già fatto e cosa dipende da te

Il codice è ottimizzato. Ma la parte del posizionamento che si risolve nei file
è quella piccola: **serve solo a non perdere posizioni che meriteresti.** Quella
che le fa guadagnare è qui sotto, e nessuna riga di HTML può farla al posto tuo.

---

## Fatto nel codice

| Cosa | Dove |
|---|---|
| Title con keyword prima del brand, description sotto i 160 caratteri | `index.html` |
| `<link rel="canonical">` su `https://fluidsstudio.it/` | `index.html` |
| Open Graph + Twitter Card + immagine 1200×630 | `index.html`, `og-image.png` |
| Dati strutturati: Organization, Person, WebSite, WebPage, Service, FAQPage | `index.html` (JSON-LD) |
| H1 con "siti web" (prima diceva solo "siti") | `index.html` |
| Sezione FAQ visibile, allineata al markup | `index.html`, `styles.css` |
| Gerarchia dei titoli corretta (i finti `<h4>` dei mockup sono `<div>`) | `index.html` |
| `sitemap.xml` + `robots.txt` che la dichiara | radice |
| Intro accorciata a ~1,2 s per rientrare nella soglia LCP | `main.js` |
| Three.js (600 KB) caricato dopo l'intro, non prima del primo paint | `main.js` |
| Particelle dimezzate su mobile | `main.js` |
| Font e librerie self-hosted (meno connessioni, niente terze parti) | `assets/`, `vendor/` |
| Anteprime Netlify marcate `noindex` per non creare duplicati | `netlify.toml` |

---

## Da fare tu, in ordine di impatto

### 1. Google Search Console — subito, il giorno del deploy

Senza questo sei cieco: non sai per cosa ti trovano, né se Google riesce a
leggere il sito.

1. <https://search.google.com/search-console> → aggiungi `fluidsstudio.it`
2. Verifica il dominio con un record DNS TXT su Aruba (metodo "Dominio", il
   più solido: copre http, https, www e non-www insieme)
3. Sitemap → invia `https://fluidsstudio.it/sitemap.xml`
4. Controllo URL → incolla la home → "Richiedi indicizzazione"

Poi torna dopo due settimane e guarda **Rendimento**: le query che ti portano
impression ma pochi clic sono quelle su cui riscrivere title e description.

### 2. Netlify: dominio primario e HTTPS

- Domain management → imposta `fluidsstudio.it` come **primary domain**
  (Netlify reindirizza automaticamente `www` e il `.netlify.app` con un 301)
- Verifica che il certificato Let's Encrypt sia attivo
- Su Aruba punta il dominio a Netlify (record A/CNAME come da loro istruzioni)

⚠️ Il canonical nel codice dice `https://fluidsstudio.it/` **senza www**. Se
preferisci il www, vanno cambiati canonical, og:url, sitemap e tutti gli `@id`
del JSON-LD. Decidi ora, non dopo.

### 3. Google Business Profile — la leva più forte per "Fluids Studio"

Esistono già diversi **Fluid Studio** nel mondo (uno fa web design in UK, altri
sono studi di architettura). Per far capire a Google che il "Fluids Studio"
italiano sei tu, serve una scheda aziendale.

- <https://business.google.com> → crea il profilo
- Scegli **"Servizi a domicilio / area di servizio"**: non serve un indirizzo
  pubblico, dichiari l'area servita (Italia)
- Nome esatto: `Fluids Studio` — identico ovunque, sempre
- Sito: `https://fluidsstudio.it`
- Email: `info@fluidsstudio.it`

Le **recensioni** qui contano moltissimo. Chiedile a ogni cliente soddisfatto,
appena consegnato il progetto.

### 4. Profili social → `sameAs`

Nel JSON-LD manca la proprietà `sameAs`, che è il modo con cui Google collega
il sito ai tuoi profili e capisce che sono la stessa entità. Quando hai gli
URL, aggiungili dentro il blocco `Organization` in `index.html`:

```json
"sameAs": [
  "https://www.linkedin.com/company/fluidsstudio",
  "https://www.instagram.com/fluidsstudio",
  "https://github.com/danilopicicci",
  "https://www.behance.net/fluidsstudio"
]
```

LinkedIn e Instagram sono i due che pesano di più per un freelance italiano.
Usa lo stesso nome, la stessa bio e la stessa immagine ovunque.

### 5. Backlink — lento, ma è il vero fattore

Google ordina i risultati soprattutto in base a **chi ti linka**. Oggi hai zero
link in entrata: è il motivo principale per cui non compari, non il codice.

Cosa funziona davvero per un web designer:

- **Il tuo lavoro.** Un piccolo "sito realizzato da Fluids Studio" nel footer
  dei siti che consegni, concordato col cliente. Ogni progetto = un link da un
  dominio nuovo e pertinente. È il canale più efficace che hai.
- **Directory italiane di freelance**: ProntoPro, Freelancerbook, Addlance.
- **Awwwards, CSSDesignAwards, Land-book**: candida questo sito. Anche una
  menzione senza premio è un link da un dominio autorevolissimo.
- **Comunità**: r/webdev, Indie Hackers, gruppi Facebook di piccole imprese.
  Rispondi con competenza, non spammare il link.

Non comprare link. Google li riconosce e la penalizzazione è peggio del nulla.

### 6. Contenuti — l'unico modo per le query generiche

"creazione siti web" è dominata da agenzie con anni di storia: non la vinci con
una pagina sola, per quanto ottimizzata. Le query aggredibili sono lunghe e
specifiche, e le intercetti scrivendo.

Idee che nascono da cose che sai già fare:

- "Quanto costa davvero un sito web nel 2026 (e perché i preventivi variano
  da 500 a 5000 €)"
- "Sito su misura o WordPress? Come scegliere senza pentirsene"
- "Perché il tuo sito è lento: 7 cause che vedo in quasi ogni audit"
- Un caso studio per ogni progetto consegnato, con numeri prima/dopo

Un articolo ogni due settimane, scritto bene, batte trenta articoli fatti in
fretta. Se aggiungi un blog, ricordati di elencare le nuove URL in
`sitemap.xml`.

---

## Cosa aspettarsi, onestamente

| Ricerca | Tempi realistici |
|---|---|
| `Fluids Studio` | 1–3 settimane dopo l'indicizzazione. Con GBP e i social collegati, primo posto molto probabile. |
| `creazione siti web animati`, `sito web con animazioni 3D` | 2–4 mesi. Nicchia poco contesa, hai un vantaggio reale: il sito *è* la dimostrazione. |
| `quanto costa un sito web su misura` | 3–6 mesi, grazie alle FAQ. |
| `creazione siti web` (secco) | Non nell'arco di un anno senza backlink e contenuti costanti. È una query da agenzie strutturate. |

Una nota sulle FAQ: dal 2023 Google mostra i risultati arricchiti FAQ quasi solo
per siti governativi e sanitari, quindi non aspettarti la fisarmonica sotto il
risultato. Il markup resta utile per far capire il contesto e per farsi citare
nelle risposte AI, e il testo visibile intercetta comunque quelle ricerche.

---

## Da rivedere quando puoi

- **`info@fluidsstudio.it` deve esistere davvero.** Configurala su Aruba o
  Netlify: un contatto che rimbalza vale meno di nessun contatto, e lo schema
  dichiara quell'indirizzo.
- **I mockup contengono testo finto** ("Villa Serena", "Costiera Amalfitana",
  "da 180 €", "Nora Vetro"). Google lo indicizza insieme al resto e diluisce di
  poco il tema della pagina. Non è grave — title, H1 e testi veri pesano molto
  di più — ma se un giorno accorci quelle scritte, guadagni un po' di
  precisione tematica.
- **Zoom bloccato su mobile** (`touch-action: pan-y` in `styles.css`): non
  influenza il ranking, ma Lighthouse lo segnala in accessibilità e per un sito
  che vende siti è una macchia visibile a chiunque faccia un audit.
- **Nessuna pagina privacy/cookie.** Il sito non usa cookie né analytics, quindi
  oggi non è obbligatoria. Diventa obbligatoria il giorno in cui aggiungi
  analytics o un form di contatto.
