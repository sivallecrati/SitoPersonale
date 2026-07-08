#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Scraper per centralina Hach SC1000 (http://<ip>/cgi-bin/SC1000).

NOTA IMPORTANTE SUI SELETTORI HTML:
Questo script è stato scritto SENZA poter analizzare l'HTML reale della
tua centralina (nessun file/immagine è arrivato allegato alla richiesta).
Per questo motivo:
  1. Il login usa i nomi di campo più comuni per le interfacce SC1000
     ("PASSWORD" per il campo password), ma vanno VERIFICATI e corretti
     nella sezione CONFIGURAZIONE qui sotto.
  2. L'estrazione dei dati delle 7 sonde usa una strategia "a cascata":
     prova prima dei selettori CSS/tabella tipici, e se non trova
     abbastanza risultati usa un fallback basato su regex sul testo
     grezzo della pagina (robusto ma meno preciso).
  3. Ho incluso una funzione `salva_html_debug()` che salva su disco
     l'HTML restituito dalla centralina dopo il login: usala una volta
     per ispezionare i tag reali (con "Visualizza sorgente" nel file
     salvato) e poi affina i selettori nella funzione
     `estrai_dati_sonde()` indicati con il commento "# <-- ADATTA QUI".

Dipendenze:
    pip install requests beautifulsoup4
"""

import json
import re
import sys
import time
from datetime import datetime

import requests
from bs4 import BeautifulSoup

# ======================================================================
# CONFIGURAZIONE — DA ADATTARE
# ======================================================================

# Indirizzo base della centralina (senza slash finale)
BASE_URL = "http://192.168.1.152/cgi-bin/SC1000"

# La stessa URL viene usata sia per il login (POST) sia per rileggere
# la landing page con i dati (GET), come tipico nelle CGI Hach.
LOGIN_URL = BASE_URL
LANDING_URL = BASE_URL

# <-- INSERISCI QUI LA PASSWORD REALE DELLA CENTRALINA
SC1000_PASSWORD = "INSERISCI_QUI_LA_PASSWORD"

# Nome del campo <input> della password nel form di login.
# Valore tipico osservato sulle interfacce SC1000 è "PASSWORD".
# Apri il file HTML di debug (vedi salva_html_debug) e cerca
# <input type="password" name="...">: se il nome è diverso, correggilo qui.
CAMPO_PASSWORD = "PASSWORD"

# Alcuni form CGI Hach richiedono anche il nome del pulsante di submit
# tra i dati POST (es. name="OK" value="Login"). Se non serve, lascia None.
CAMPO_SUBMIT_NOME = None   # es. "OK"
CAMPO_SUBMIT_VALORE = None  # es. "Login"

# Intervallo di polling in secondi
INTERVALLO_SECONDI = 10

# Timeout per le richieste HTTP (secondi)
TIMEOUT_RICHIESTA = 8

# Testo che la centralina restituisce in caso di login fallito /
# sessione bloccata. Adatta se il messaggio reale è diverso.
MESSAGGI_ERRORE_LOGIN = [
    "Accesso negato",
    "accesso negato",
    "Access denied",
    "Password errata",
]

# ======================================================================
# STATO GLOBALE DELLA SESSIONE
# ======================================================================

# requests.Session() mantiene automaticamente i cookie restituiti dalla
# centralina dopo il login, così le richieste successive alla landing
# page risultano già autenticate senza dover rifare il POST ogni volta.
sessione = requests.Session()
sessione_autenticata = False


def effettua_login():
    """
    Invia la password al form CGI della centralina.

    Ritorna True se il login sembra riuscito, False altrimenti.
    Il login viene fatto via POST (il caso più comune per le CGI Hach);
    se la tua centralina usa invece GET, cambia sessione.post in
    sessione.get e passa i dati con params= invece di data=.
    """
    global sessione_autenticata

    payload = {CAMPO_PASSWORD: SC1000_PASSWORD}
    if CAMPO_SUBMIT_NOME:
        payload[CAMPO_SUBMIT_NOME] = CAMPO_SUBMIT_VALORE

    try:
        risposta = sessione.post(
            LOGIN_URL,
            data=payload,
            timeout=TIMEOUT_RICHIESTA,
        )
        risposta.raise_for_status()
    except requests.exceptions.RequestException as errore:
        print(f"[LOGIN] Errore di rete durante il login: {errore}")
        sessione_autenticata = False
        return False

    corpo_pagina = risposta.text

    # Se la pagina di risposta contiene ancora il form di login o un
    # messaggio di errore, consideriamo il login fallito.
    if any(msg.lower() in corpo_pagina.lower() for msg in MESSAGGI_ERRORE_LOGIN):
        print("[LOGIN] La centralina ha rifiutato la password (accesso negato).")
        sessione_autenticata = False
        return False

    if "type=\"password\"" in corpo_pagina.lower() or "type='password'" in corpo_pagina.lower():
        print("[LOGIN] Risposta contiene ancora il form di login: password non valida?")
        sessione_autenticata = False
        return False

    sessione_autenticata = True
    print("[LOGIN] Login effettuato con successo, sessione stabilita.")
    return True


def salva_html_debug(html, percorso="debug_landing_page.html"):
    """
    Salva su disco l'HTML ricevuto per poterlo ispezionare manualmente
    (utile una tantum per individuare i tag esatti delle 7 sonde).
    """
    with open(percorso, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"[DEBUG] HTML salvato in '{percorso}' per ispezione manuale.")


def _pulisci_testo(testo):
    return re.sub(r"\s+", " ", testo or "").strip()


def estrai_dati_sonde(html):
    """
    Analizza l'HTML della landing page ed estrae nome/valore/unità delle
    7 sonde. Strategia a cascata:

      1) Cerca righe di tabella (<tr> con almeno 2 <td>): è il pattern
         più comune per liste di parametri industriali. Il primo <td>
         viene preso come nome sonda, gli altri concatenati come
         valore + unità.
         # <-- ADATTA QUI se la tabella reale ha una struttura diversa
         (es. sostituisci il find_all("tr") con
         soup.select("table#dati tr") una volta noto l'id/la classe reale)

      2) Se il metodo 1 non produce risultati sufficienti, esegue un
         fallback basato su regex sul testo dell'intera pagina, cercando
         pattern del tipo "Nome Sonda: 12.34 unità".

    Ritorna un dizionario {nome_sonda: "valore unità"}.
    """
    soup = BeautifulSoup(html, "html.parser")
    dati = {}

    # --- Strategia 1: righe di tabella ---
    for riga in soup.find_all("tr"):
        celle = riga.find_all(["td", "th"])
        if len(celle) < 2:
            continue

        nome = _pulisci_testo(celle[0].get_text())
        valore_unita = _pulisci_testo(" ".join(c.get_text() for c in celle[1:]))

        if not nome or not valore_unita:
            continue

        # Scarta righe di intestazione ovvie (es. "Nome" / "Valore")
        if nome.lower() in ("nome", "sonda", "parametro", "value", "unit"):
            continue

        dati[nome] = valore_unita

    if len(dati) >= 7:
        return dati

    # --- Strategia 2 (fallback): regex sul testo grezzo ---
    dati_fallback = {}
    testo = soup.get_text(separator="\n")
    # Pattern: "Etichetta ... numero (anche negativo/decimale) ... unità"
    pattern = re.compile(
        r"([A-Za-zÀ-ÿ0-9()./ _-]{3,40}?)[:\s]+(-?\d+(?:[.,]\d+)?)\s*([A-Za-zµ%/°]{1,10})"
    )
    for match in pattern.finditer(testo):
        nome = _pulisci_testo(match.group(1))
        valore = match.group(2).replace(",", ".")
        unita = match.group(3)
        if nome:
            dati_fallback[nome] = f"{valore} {unita}"

    # Usa il fallback solo se ha trovato più risultati della strategia 1
    return dati_fallback if len(dati_fallback) > len(dati) else dati


def leggi_dati_centralina():
    """
    Effettua la richiesta GET alla landing page e ne estrae i dati delle
    sonde. Gestisce il caso di sessione scaduta tentando un nuovo login.

    Ritorna una tupla (stato, dati) dove stato è "OK" o una stringa che
    descrive l'errore, e dati è il dizionario delle sonde (vuoto in caso
    di errore).
    """
    global sessione_autenticata

    if not sessione_autenticata:
        if not effettua_login():
            return "LOGIN_FALLITO", {}

    try:
        risposta = sessione.get(LANDING_URL, timeout=TIMEOUT_RICHIESTA)
        risposta.raise_for_status()
    except requests.exceptions.Timeout:
        return "TIMEOUT", {}
    except requests.exceptions.ConnectionError:
        return "ERRORE_RETE", {}
    except requests.exceptions.RequestException as errore:
        return f"ERRORE_HTTP: {errore}", {}

    corpo_pagina = risposta.text

    # Se troviamo di nuovo il form di login o un messaggio di accesso
    # negato, la sessione è scaduta: forziamo un nuovo login e ritentiamo
    # una sola volta nello stesso ciclo.
    sessione_scaduta = any(
        msg.lower() in corpo_pagina.lower() for msg in MESSAGGI_ERRORE_LOGIN
    ) or "type=\"password\"" in corpo_pagina.lower()

    if sessione_scaduta:
        sessione_autenticata = False
        print("[SESSIONE] Sessione scaduta o accesso negato, ripeto il login...")
        if not effettua_login():
            return "LOGIN_FALLITO", {}
        try:
            risposta = sessione.get(LANDING_URL, timeout=TIMEOUT_RICHIESTA)
            risposta.raise_for_status()
            corpo_pagina = risposta.text
        except requests.exceptions.RequestException as errore:
            return f"ERRORE_HTTP_DOPO_RELOGIN: {errore}", {}

    dati_sonde = estrai_dati_sonde(corpo_pagina)

    if not dati_sonde:
        # Nessun dato estratto: salviamo l'HTML per capire perché,
        # ma non consideriamo questo un crash dello script.
        salva_html_debug(corpo_pagina)
        return "NESSUN_DATO_ESTRATTO", {}

    return "OK", dati_sonde


def ciclo_principale():
    """
    Loop infinito: interroga la centralina ogni INTERVALLO_SECONDI e
    stampa un dizionario JSON con timestamp, stato e dati delle sonde.
    Qualsiasi eccezione imprevista viene intercettata per evitare che
    lo script si interrompa: si passa semplicemente al ciclo successivo.
    """
    print(f"Avvio monitoraggio centralina Hach SC1000 su {BASE_URL}")
    print(f"Intervallo di polling: {INTERVALLO_SECONDI} secondi\n")

    while True:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        try:
            stato, dati_sonde = leggi_dati_centralina()
        except Exception as errore:  # Rete non prevista / bug non anticipato
            stato, dati_sonde = f"ERRORE_IMPREVISTO: {errore}", {}

        risultato = {
            "timestamp": timestamp,
            "stato_connessione": stato,
            "dati_sonde": dati_sonde,
        }

        print(json.dumps(risultato, ensure_ascii=False, indent=2))

        try:
            time.sleep(INTERVALLO_SECONDI)
        except KeyboardInterrupt:
            print("\nInterruzione richiesta dall'utente, chiusura script.")
            sys.exit(0)


if __name__ == "__main__":
    try:
        ciclo_principale()
    except KeyboardInterrupt:
        print("\nInterruzione richiesta dall'utente, chiusura script.")
        sys.exit(0)
