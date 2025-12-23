// ZeppScout.js

// **DEFINIZIONE DELLE AZIONI E DEGLI ESITI (Il cuore dinamico)**
// Modificare questi array è l'unico punto per aggiungere/rimuovere azioni o esiti.
const ACTIONS = [
    { code: 'A', name: 'Action A', colorClass: 'color-A' },
    { code: 'B', name: 'Action B', colorClass: 'color-B' },
    { code: 'V', name: 'Action V', colorClass: 'color-V' },
    { code: 'P', name: 'Action P', colorClass: 'color-P' }
    // Aggiungi qui nuove azioni!
];

const OUTCOMES = [
    { suffix: '+', weight: 10 },
    { suffix: '=', weight: 5 },
    { suffix: '-', weight: 0 }
    // Aggiungi qui nuovi esiti!
];

// Generazione dinamica della lista di tutti i bottoni e della mappatura dei pesi
const ALL_BUTTONS = ACTIONS.flatMap(action => 
    OUTCOMES.map(outcome => action.code + outcome.suffix)
);

// Mappatura delle categorie
const CATEGORIES = ACTIONS.map(a => a.code);

// Mappatura dei pesi per il calcolo del voto (0-10)
const WEIGHTS = {};
OUTCOMES.forEach(o => {
    WEIGHTS[o.suffix] = o.weight;
});

// Mappatura colori per la notifica (Devono corrispondere a ZeppScout.css)
const COLOR_MAP = {
    'A': '#3b82f6', // Blu
    'B': '#10b981', // Verde
    'V': '#f59e0b', // Giallo/Ambra
    'P': '#ef4444'  // Rosso
};


// **NOMI FILE**
const LOG_FILENAME = 'Scouting_Log.csv';
const SUMMARY_FILENAME = 'Scouting_Summary.csv';

// Variabile globale per l'area di testo del log
let logContentArea;


/**
 * Aggiorna il contenuto del log nell'area di testo e scorre in basso.
 * Lo stato viene anche salvato in localStorage per persistere tra i refresh della pagina.
 * @param {string} newContent Il nuovo contenuto completo del log.
 */
function updateLog(newContent) {
    logContentArea.value = newContent;
    // Scorre fino alla fine dell'area di testo
    logContentArea.scrollTop = logContentArea.scrollHeight;
    // Salva in localStorage per la persitenza tra i refresh
    localStorage.setItem('zeppLoggerLog', newContent);
}

/**
 * Carica il log salvato da localStorage all'apertura.
 */
function loadLog() {
    const savedContent = localStorage.getItem('zeppLoggerLog') || '';
    updateLog(savedContent);
}

/**
 * Estrae il codice azione (es. 'A' da 'A+') dall'entry.
 * @param {string} entry La sigla del pulsante (es. 'A+', 'B=', 'V-').
 * @returns {string} Il codice azione.
 */
function getActionCodeFromEntry(entry) {
    // Il codice azione è sempre il primo carattere
    return entry.charAt(0);
}

/**
 * Visualizza temporaneamente il punteggio aggiornato per l'azione.
 * @param {string} actionCode Il codice azione ('A', 'B', ecc.).
 * @param {string} score Il voto calcolato (es. "7.50" o "N/D").
 */
function showScoreNotification(actionCode, score) {
    // Rimuove eventuali notifiche precedenti
    document.querySelectorAll('.score-notification').forEach(n => n.remove());

    const notification = document.createElement('div');
    notification.className = 'score-notification fixed top-4 left-1/2 transform -translate-x-1/2 p-3 rounded-lg text-white font-bold shadow-xl transition-opacity duration-300 z-50';
    
    // Usa la mappatura dei colori
    const color = COLOR_MAP[actionCode] || '#4b5563'; // Grigio di fallback
    notification.style.backgroundColor = color;
    
    notification.innerHTML = `New evaluation for ${actionCode}: ${score}`;

    document.body.appendChild(notification);

    // Fade out e rimozione dopo 3 secondi
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300); // Rimuovi dopo la transizione
    }, 3000); 
}


/**
 * Aggiunge una riga di log e mostra il voto aggiornato dell'azione.
 * @param {string} entry La sigla del pulsante da loggare.
 */
function addLogEntry(entry) {
    const currentContent = logContentArea.value;
    
    // 1. Aggiungi l'entry al log
    const now = new Date();
    const timestamp = now.toLocaleDateString('it-IT') + ' ' + now.toLocaleTimeString('it-IT');
    const newEntry = `${timestamp} ;${entry}\n`;

    const updatedContent = currentContent + newEntry;
    updateLog(updatedContent); // Aggiorna e salva il log

    // 2. Calcola il nuovo punteggio per l'azione appena loggata
    const actionCode = getActionCodeFromEntry(entry);
    
    // Ricalcola le frequenze basandoti sul NUOVO LOG (updatedContent)
    const { counts } = calculateFrequenciesFromContent(updatedContent); 
    
    const newScore = calculateActionScore(actionCode, counts);
    
    // 3. Mostra la notifica del punteggio
    showScoreNotification(actionCode, newScore);
}


/**
 * Svuota il contenuto del log.
 */
function clearLog() {
    if (!window.confirm("Are you sure to clear the Content ? You can't undo this operation.")) {
        return;
    }
    updateLog('');
    console.log("Scouting initialized.");
}


/**
 * Funzione generica per scaricare un contenuto come file.
 * @param {string} content Il contenuto da scaricare.
 * @param {string} filename Il nome del file.
 */
function downloadFile(content, filename) {
    // Correzione della logica di controllo del contenuto
    if (!content || !content.trim()) { 
        window.alert("Scouting empty.");
        return;
    }
    
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    
    link.href = URL.createObjectURL(blob);
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(link.href);
}

/**
 * Gestisce il download del file di log (Scouting.csv) e del riepilogo.
 */
function downloadLog() {
    // 1. Scarica il log completo (contenuto nell'area di testo)
    downloadFile(logContentArea.value, LOG_FILENAME);
    // 2. Genera e scarica il riepilogo
    generateSummaryAndDownload();
}


/**
 * Calcola le frequenze di pressione per ogni bottone e i totali per riga, 
 * usando un contenuto di log specifico invece dell'area globale.
 * @param {string} logContentToUse Il contenuto del log su cui basare il calcolo.
 * @returns {{counts: Object<string, number>, totals: Object<string, number>}} Un oggetto contenente i conteggi dei singoli bottoni e i totali per categoria.
 */
function calculateFrequenciesFromContent(logContentToUse) {
    const logContent = logContentToUse;
    const counts = {}; 
    const initialTotals = {};

    // Inizializza tutti i conteggi a 0
    ALL_BUTTONS.forEach(btn => {
        counts[btn] = 0;
    });
    CATEGORIES.forEach(type => {
        initialTotals[`tot${type}`] = 0;
    });

    if (!logContent.trim()) {
        return {
            counts: counts,
            totals: initialTotals
        };
    }

    const lines = logContent.trim().split('\n');
    
    // Analizza ogni riga del log
    lines.forEach(line => {
        const parts = line.split('#');
        if (parts.length > 1) {
            const entry = parts[1].trim(); 
            if (ALL_BUTTONS.includes(entry)) {
                counts[entry] = (counts[entry] || 0) + 1;
            }
        }
    });

    // Calcola i totalizzatori per riga (Categoria)
    const totals = {};
    CATEGORIES.forEach(type => {
        totals[`tot${type}`] = OUTCOMES.reduce((sum, outcome) => {
            const key = type + outcome.suffix;
            return sum + (counts[key] || 0);
        }, 0);
    });
    
    return { counts, totals };
}


/**
 * Calcola le frequenze di pressione per ogni bottone e i totali per riga.
 * Funzione di wrapper che utilizza il contenuto attuale dell'area log.
 * @returns {{counts: Object<string, number>, totals: Object<string, number>}} Un oggetto contenente i conteggi dei singoli bottoni e i totali per categoria.
 */
function calculateFrequencies() {
    return calculateFrequenciesFromContent(logContentArea.value);
}


/**
 * Calcola il "voto" da 0 a 10 per una singola azione
 * usando la media ponderata degli esiti.
 * @param {string} type Il codice azione ('A', 'B', 'V', 'P').
 * @param {Object<string, number>} counts Oggetto con i conteggi di tutti i bottoni.
 * @returns {string} Il voto arrotondato a due decimali (es. "6.67") o "N/D" se Totale è 0.
 */
function calculateActionScore(type, counts) {
    let total = 0;
    let weightedSum = 0;

    OUTCOMES.forEach(outcome => {
        const key = type + outcome.suffix; // es. 'A+'
        const count = counts[key] || 0;
        total += count;
        weightedSum += count * WEIGHTS[outcome.suffix];
    });

    if (total === 0) {
        return "N/D";
    }

    const score = weightedSum / total;

    // Arrotonda a due cifre decimali
    return score.toFixed(2); 
}


/**
 * Funzione di utilità per calcolare la percentuale e arrotondarla.
 * @param {number} value Il valore da convertire in percentuale.
 * @param {number} total Il totale.
 * @returns {string} La percentuale arrotondata (es. "36%").
 */
function calculatePercentage(value, total) {
    if (total === 0) return "0%";
    const percentage = Math.round((value / total) * 100);
    return `${percentage}%`;
}


/**
 * Genera dinamicamente tutti i bottoni e li aggiunge al DOM.
 * La logica è dinamica basata su ACTIONS e OUTCOMES.
 */
function generateButtons() {
    const buttonGrid = document.getElementById('button-grid');
    buttonGrid.innerHTML = ''; // Svuota il contenitore esistente

    ACTIONS.forEach(action => {
        OUTCOMES.forEach(outcome => {
            const buttonText = action.code + outcome.suffix;
            
            const button = document.createElement('button');
            button.id = `btn-${buttonText}`;
            button.className = `log-button rounded-full ${action.colorClass}`;
            button.textContent = buttonText;
            button.disabled = true; // Sarà abilitato in DOMContentLoaded

            buttonGrid.appendChild(button);
        });
    });
}


/**
 * Genera il riepilogo dettagliato in formato CSV, inclusi i voti da 0 a 10.
 * La logica è dinamica basata su ACTIONS e OUTCOMES.
 */
function generateSummaryAndDownload() {
    const { counts, totals } = calculateFrequencies();
    
    // Calcola il totale generale delle pressioni
    const totalPressioniGenerale = CATEGORIES.reduce((sum, type) => sum + totals[`tot${type}`], 0);

    if (totalPressioniGenerale === 0) {
        window.alert("Summary empty.");
        return;
    }

    // 1. Inizializza l'header CSV in modo dinamico
    let summaryContent = "Azione;Voto;#/Tot;% su tot;";
    // Aggiungi le intestazioni dinamiche dei dettagli (es. Dettaglio +;Dettaglio =;...)
    summaryContent += OUTCOMES.map(o => `Dettaglio ${o.suffix}`).join(';') + '\n';
    
    // 2. Aggiunge le righe di riepilogo dettagliato
    CATEGORIES.forEach(type => {
        const totalAzione = totals[`tot${type}`]; 
        const actionScore = calculateActionScore(type, counts); 
        const percentAzioneGenerale = calculatePercentage(totalAzione, totalPressioniGenerale); 
        
        const rigaBase = [
            type,                                                                // 1. Tipo Azione (B)
            actionScore,                                                         // 2. Voto (0-10)
            `${totalAzione}/${totalPressioniGenerale}`,                          // 3. Totale Azione/Totale Generale (12/33)
            percentAzioneGenerale,                                               // 4. % Azione sul Totale Generale (36%)
        ];
        
        // Aggiungi i dettagli dinamici per gli esiti (+, =, -)
        const dettagliEsiti = OUTCOMES.map(outcome => {
            const suffix = outcome.suffix;
            const count = counts[`${type}${suffix}`] || 0;
            const percent = calculatePercentage(count, totalAzione);
            return `(${suffix} ${count} ${percent})`; 
        });

        // Costruzione della riga completa (separatore ;)
        const rigaDettagliata = rigaBase.concat(dettagliEsiti).join(';');

        summaryContent += `${rigaDettagliata}\n`;
    });
    // Avvia il download
    downloadFile(summaryContent, SUMMARY_FILENAME);
}


// --- Inizializzazione degli Event Listener e Caricamento Iniziale (UNIFICATO) ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Assegna la variabile globale del campo di testo
    logContentArea = document.getElementById('log-content');
    const buttonGrid = document.getElementById('button-grid');
    
    // 2. Genera i bottoni dinamicamente e carica il log
    generateButtons(); 
    loadLog();
    
    // 3. Abilita TUTTI i pulsanti e i controlli (dopo che sono stati generati)
    document.querySelectorAll('.log-button').forEach(button => {
        button.disabled = false;
    });
    document.getElementById('download-btn').disabled = false;
    document.getElementById('clear-btn').disabled = false;

    // 4. Listener per i pulsanti di log (A+, B=, ecc.)
    buttonGrid.addEventListener('click', (event) => {
        const button = event.target.closest('.log-button');
        if (button && !button.disabled) {
            const entry = button.textContent.trim();
            addLogEntry(entry);
        }
    });

    // 5. Listener per il download e lo svuotamento
    document.getElementById('download-btn').addEventListener('click', downloadLog);
    document.getElementById('clear-btn').addEventListener('click', clearLog);
});