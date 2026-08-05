/**
 * Náhrada za balík `server-only` v testoch.
 *
 * V produkcii je `server-only` značka, ktorú Next použije pri builde na to,
 * aby zhodil preklad, keď sa serverový modul dostane do klientského kódu.
 * Mimo Nextu sa nedá importovať, takže by testy takých modulov ani
 * nenaštartovali. Prázdny modul tú kontrolu neoslabuje — deje sa pri builde.
 */
export {}
