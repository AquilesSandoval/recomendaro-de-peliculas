% Declarar encoding UTF-8 para caracteres especiales en español
:- set_prolog_flag(encoding, utf8).

% ================================================================
% arbol_preguntas.pl — Arbol de decision adaptativo
% CineExpert — Proyecto Final Programación Lógica
%
% CONCEPTOS DEMOSTRADOS:
%   [ÁRBOL]        El árbol de preguntas se representa como término
%                  Prolog: nodo(Id, SubArbolIzq, SubArbolDer)
%   [LISTAS]       Las opciones de cada pregunta son listas Prolog;
%                  se usan findall/3, member/2, append/3
%   [RECURSIVIDAD] Navegación del árbol y cálculo de eliminación son recursivos
% ================================================================

:- module(arbol_preguntas, [
    pregunta/4,
    siguiente_pregunta/3,
    preguntas_restantes/2,
    opcion_a_genero/2,
    suma_lista/2
]).

% ================================================================
% HECHOS: Definición de las preguntas disponibles
% pregunta(Id, TextoMostrar, Tipo, Opciones)
%   Tipo unico    = el usuario elige una sola opción (radio)
%   Tipo multiple = el usuario puede elegir varias (checkbox)
%
% [LISTAS] — Las opciones de cada pregunta son una lista Prolog
% ================================================================

pregunta(genero,
    '¿Qué géneros de película te gustan?',
    multiple,
    [accion, aventura, comedia, drama, terror, sci_fi, animacion, romance, thriller, documental]).

pregunta(epoca,
    '¿De qué época prefieres las películas?',
    unico,
    [clasico, noventas, dos_miles, dos_diez, reciente]).

pregunta(tono,
    '¿Qué tono prefieres en una película?',
    unico,
    [ligero, moderado, serio, oscuro]).

pregunta(duracion,
    '¿Cuánto tiempo tienes para ver la película?',
    unico,
    [corta, normal, larga]).

pregunta(idioma,
    '¿En qué idioma prefieres ver la película?',
    unico,
    [ingles, espanol, cualquiera]).

pregunta(rating_min,
    '¿Qué calidad mínima esperas?',
    unico,
    [cualquiera, buena, muy_buena, excelente]).

% ================================================================
% ÁRBOL DE DECISIÓN — Estructura de árbol como término Prolog
%
% [ÁRBOL] — nodo(Id, SubArbolIzq, SubArbolDer)
%   SubArbolIzq: siguiente rama si esta pregunta se responde
%   SubArbolDer: rama alternativa si se salta esta pregunta
%   hoja: fin del camino en el árbol
%
% El árbol define el ORDEN PREFERIDO de preguntas.
% La selección adaptativa puede cambiarlo según los candidatos.
% ================================================================

arbol_preguntas(
    nodo(genero,
        nodo(epoca,
            nodo(tono,
                nodo(duracion,
                    nodo(rating_min,
                        nodo(idioma, hoja, hoja),
                        hoja),
                    hoja),
                nodo(idioma, hoja, hoja)),
            nodo(tono,
                nodo(duracion, hoja, hoja),
                hoja)),
        nodo(epoca,
            nodo(duracion, hoja, hoja),
            hoja))
).

% ================================================================
% preguntas_en_arbol(+Arbol, -Lista)
% Extrae todos los IDs de preguntas del árbol en orden DFS
%
% [RECURSIVIDAD] — Caso base: hoja devuelve lista vacía
%                   Caso recursivo: extrae id del nodo y
%                   concatena los resultados de ambas ramas
% [LISTAS]       — Usa append/3 para unir las listas de cada rama
% ================================================================
preguntas_en_arbol(hoja, []).                          % caso base: hoja = lista vacía
preguntas_en_arbol(nodo(Id, Izq, Der), [Id | Resto]) :-
    preguntas_en_arbol(Izq, ListaIzq),                 % [RECURSIVIDAD] rama izquierda
    preguntas_en_arbol(Der, ListaDer),                 % [RECURSIVIDAD] rama derecha
    append(ListaIzq, ListaDer, Resto).                 % [LISTAS] une ambas listas

% ================================================================
% preguntas_restantes(+Respondidas, -Pendientes)
% Devuelve la lista de preguntas que aún no se han respondido
%
% [LISTAS] — findall/3 construye la lista de preguntas pendientes
%             member/2 verifica pertenencia en la lista respondidas
% ================================================================
preguntas_restantes(Respondidas, Pendientes) :-
    arbol_preguntas(Arbol),
    preguntas_en_arbol(Arbol, OrdenCompleto),
    % [LISTAS] — findall filtra las que NO están en Respondidas
    findall(P,
        (member(P, OrdenCompleto),          % P está en el árbol
         \+ member(P, Respondidas)),        % P aún no fue respondida
        Pendientes).

% ================================================================
% siguiente_pregunta(+Respondidas, +Candidatos, -MejorPregunta)
% Selecciona la siguiente pregunta de forma ADAPTATIVA:
% elige la que eliminaría más candidatos en promedio.
%
% [LISTAS]       — findall construye lista de pares Eliminacion-Pregunta
% [RECURSIVIDAD] — eliminacion_esperada es recursiva sobre las opciones
% ================================================================
siguiente_pregunta(Respondidas, Candidatos, MejorPregunta) :-
    preguntas_restantes(Respondidas, Pendientes),
    Pendientes \= [],                                   % todavía hay preguntas
    % [LISTAS] — construir lista de pares Eliminacion-Pregunta
    findall(Elim-P,
        (member(P, Pendientes),
         eliminacion_esperada(P, Candidatos, Elim)),
        Pares),
    % Elegir la pregunta que más candidatos eliminaría
    max_member(_-MejorPregunta, Pares).

% ================================================================
% eliminacion_esperada(+IdPregunta, +Candidatos, -Eliminacion)
% Calcula cuántos candidatos eliminaría en PROMEDIO esta pregunta
% si el usuario pudiera dar cualquiera de las respuestas posibles.
%
% [LISTAS]       — findall colecta la lista de supervivientes por opción
% [RECURSIVIDAD] — suma_lista/2 suma la lista recursivamente
% ================================================================
eliminacion_esperada(IdPregunta, Candidatos, Eliminacion) :-
    pregunta(IdPregunta, _, _, Opciones),               % obtener opciones
    length(Candidatos, Total),
    % [LISTAS] — para cada opción, cuántos candidatos sobrevivirían
    findall(NSobrev,
        (member(Opcion, Opciones),
         contar_supervivientes(IdPregunta, Opcion, Candidatos, NSobrev)),
        ConteosPorOpcion),
    suma_lista(ConteosPorOpcion, SumaSupervivientes),  % [RECURSIVIDAD] suma la lista
    length(Opciones, NOpciones),
    (NOpciones > 0 ->
        Promedio is SumaSupervivientes / NOpciones
    ;
        Promedio is Total),
    Eliminacion is Total - Promedio.                   % promedio de candidatos eliminados

% ================================================================
% contar_supervivientes(+Pregunta, +Opcion, +Candidatos, -N)
% Para una pregunta y respuesta hipotética, cuenta cuántos de los
% candidatos actuales sobrevivirían el filtro.
%
% [LISTAS] — findall filtra la lista de candidatos
% ================================================================
contar_supervivientes(genero, Opcion, Candidatos, N) :-
    opcion_a_genero(Opcion, IdGenero),
    % [LISTAS] — cuántos candidatos tienen ese género
    findall(Id,
        (member(Id, Candidatos),
         pelicula_genero(Id, IdGenero)),
        Sobrev),
    length(Sobrev, N).

contar_supervivientes(epoca, Opcion, Candidatos, N) :-
    % [LISTAS] — cuántos candidatos son de esa época
    findall(Id,
        (member(Id, Candidatos),
         pelicula(Id, _, Anio, _, _),
         anio_en_epoca(Anio, Opcion)),
        Sobrev),
    length(Sobrev, N).

contar_supervivientes(tono, Opcion, Candidatos, N) :-
    findall(Id,
        (member(Id, Candidatos),
         pelicula(Id, _, _, _, Opcion)),
        Sobrev),
    length(Sobrev, N).

contar_supervivientes(duracion, Opcion, Candidatos, N) :-
    findall(Id,
        (member(Id, Candidatos),
         pelicula_detalle(Id, _, Dur),
         duracion_en_rango(Dur, Opcion)),
        Sobrev),
    length(Sobrev, N).

contar_supervivientes(idioma, cualquiera, Candidatos, N) :-
    length(Candidatos, N).                             % cualquiera = no filtra

contar_supervivientes(idioma, Opcion, Candidatos, N) :-
    Opcion \= cualquiera,
    opcion_a_idioma(Opcion, CodIdioma),
    findall(Id,
        (member(Id, Candidatos),
         pelicula_detalle(Id, CodIdioma, _)),
        Sobrev),
    length(Sobrev, N).

contar_supervivientes(rating_min, cualquiera, Candidatos, N) :-
    length(Candidatos, N).

contar_supervivientes(rating_min, Opcion, Candidatos, N) :-
    Opcion \= cualquiera,
    opcion_a_rating(Opcion, MinRating),
    findall(Id,
        (member(Id, Candidatos),
         pelicula(Id, _, _, Rating, _),
         Rating >= MinRating),
        Sobrev),
    length(Sobrev, N).

% ================================================================
% Predicados auxiliares de mapeo
% ================================================================

% anio_en_epoca(+Anio, +Epoca) — verifica que el año cae en la época
anio_en_epoca(A, clasico)   :- A < 1990.
anio_en_epoca(A, noventas)  :- A >= 1990, A < 2000.
anio_en_epoca(A, dos_miles) :- A >= 2000, A < 2010.
anio_en_epoca(A, dos_diez)  :- A >= 2010, A < 2020.
anio_en_epoca(A, reciente)  :- A >= 2020.

% duracion_en_rango(+Min, +Rango)
duracion_en_rango(D, corta)  :- D < 90.
duracion_en_rango(D, normal) :- D >= 90, D =< 120.
duracion_en_rango(D, larga)  :- D > 120.

% opcion_a_idioma(+Opcion, -Codigo)
opcion_a_idioma(ingles,  en).
opcion_a_idioma(espanol, es).

% opcion_a_rating(+Opcion, -Minimo)
opcion_a_rating(buena,     6.0).
opcion_a_rating(muy_buena, 7.0).
opcion_a_rating(excelente, 8.0).

% [LISTAS] opcion_a_genero — tabla de mapeo átomo → ID de TMDB
opcion_a_genero(accion,      28).
opcion_a_genero(aventura,    12).
opcion_a_genero(comedia,     35).
opcion_a_genero(drama,       18).
opcion_a_genero(terror,      27).
opcion_a_genero(sci_fi,     878).
opcion_a_genero(animacion,   16).
opcion_a_genero(romance,  10749).
opcion_a_genero(thriller,    53).
opcion_a_genero(documental,  99).

% ================================================================
% suma_lista(+Lista, -Suma)
% Suma todos los números de una lista
%
% [RECURSIVIDAD] — Caso base: lista vacía suma 0
%                   Caso recursivo: cabeza + suma del resto
% ================================================================
suma_lista([], 0).                                     % caso base
suma_lista([H | T], Suma) :-
    suma_lista(T, SumaResto),                          % [RECURSIVIDAD] suma el resto
    Suma is H + SumaResto.                             % agrega la cabeza
