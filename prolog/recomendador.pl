% Declarar encoding UTF-8 para caracteres especiales en español
:- set_prolog_flag(encoding, utf8).

% ================================================================
% recomendador.pl — Motor de recomendacion de peliculas
% CineExpert — Proyecto Final Programación Lógica
%
% CONCEPTOS DEMOSTRADOS:
%   [LISTAS]       findall/3, member/2, append/3, intersección de géneros,
%                  ordenamiento de listas con msort/2
%   [RECURSIVIDAD] Cálculo acumulativo de puntajes, recorrido de candidatos,
%                  construcción recursiva de explicaciones
%   [ÁRBOL]        Se usa el árbol de arbol_preguntas.pl para navegar
%                  el orden de preguntas
%   [REGLAS]       Encadenamiento hacia atrás para inferir recomendaciones
%   [NEGACIÓN]     \+ (negación por fallo) para "¿Por qué no esta?"
% ================================================================

:- module(recomendador, [
    candidatos_actuales/2,
    top5_recomendaciones/2,
    puntaje_pelicula/3,
    explicar_recomendacion/3,
    por_que_no_recomendada/3
]).

:- use_module(arbol_preguntas).

% ================================================================
% candidatos_actuales(+Respuestas, -Candidatos)
% Filtra todas las películas según las respuestas del usuario.
% Solo pasan las películas que cumplen TODOS los criterios respondidos.
%
% [LISTAS] — findall/3 construye la lista de IDs que pasan el filtro
%             member/2 verifica cada respuesta
% ================================================================
candidatos_actuales(Respuestas, Candidatos) :-
    % [LISTAS] — findall obtiene todos los IDs de películas que cumplen los filtros
    findall(Id,
        (pelicula(Id, _, _, _, _),      % existe la película
         cumple_todos(Id, Respuestas)), % cumple todos los criterios
        Candidatos).

% ================================================================
% cumple_todos(+IdPelicula, +Respuestas)
% Verifica recursivamente que la película cumple cada criterio.
%
% [RECURSIVIDAD] — Caso base: sin respuestas, cualquier película pasa
%                   Caso recursivo: verifica la cabeza y luego el resto
% ================================================================
cumple_todos(_, []).                                    % caso base: sin filtros
cumple_todos(Id, [Resp | Resto]) :-
    cumple_criterio(Id, Resp),                         % [RECURSIVIDAD] verifica este criterio
    cumple_todos(Id, Resto).                           % [RECURSIVIDAD] verifica el resto

% ================================================================
% cumple_criterio(+IdPelicula, +Respuesta)
% Reglas de inferencia: ¿cumple la película este criterio?
% Cada cláusula es una REGLA de Prolog con encadenamiento hacia atrás.
% ================================================================

% Criterio de género: al menos un género en común
% [LISTAS] — member/2 verifica que el género está en la lista preferida
cumple_criterio(Id, respuesta(genero, GenerosPreferidos)) :-
    % [LISTAS] — busca si algún género de la película está en los preferidos
    findall(G, pelicula_genero(Id, G), GenerosFilm),
    findall(GId,
        (member(GAtomo, GenerosPreferidos),
         opcion_a_genero(GAtomo, GId)),
        IdsPreferidos),
    % intersection verifica que comparten al menos un género
    intersection(GenerosFilm, IdsPreferidos, Comunes),
    Comunes \= [].  % debe haber al menos un género en común

% Criterio de época
cumple_criterio(Id, respuesta(epoca, Epoca)) :-
    pelicula(Id, _, Anio, _, _),
    anio_en_epoca(Anio, Epoca).

% Criterio de tono
cumple_criterio(Id, respuesta(tono, Tono)) :-
    pelicula(Id, _, _, _, Tono).

% Criterio de duración (si no hay dato, la película pasa de todas formas)
cumple_criterio(Id, respuesta(duracion, Duracion)) :-
    (pelicula_detalle(Id, _, Dur) ->
        duracion_en_rango(Dur, Duracion)
    ;
        true).  % sin dato de duración, no descartamos

% Criterio de idioma
cumple_criterio(Id, respuesta(idioma, cualquiera)) :- !.   % cualquiera = pasa todo
cumple_criterio(Id, respuesta(idioma, Idioma)) :-
    opcion_a_idioma(Idioma, Codigo),
    pelicula_detalle(Id, Codigo, _).

% Criterio de rating mínimo
cumple_criterio(_, respuesta(rating_min, cualquiera)) :- !.
cumple_criterio(Id, respuesta(rating_min, Nivel)) :-
    opcion_a_rating(Nivel, Minimo),
    pelicula(Id, _, _, Rating, _),
    Rating >= Minimo.

% ================================================================
% puntaje_pelicula(+IdPelicula, +Respuestas, -Puntaje)
% Calcula el puntaje de afinidad de una película (0 a 100).
%
% [RECURSIVIDAD] — puntaje_acumulado recorre la lista de respuestas
%                   sumando puntos por cada criterio cumplido
% ================================================================
puntaje_pelicula(Id, Respuestas, PorcentajeRedondeado) :-
    length(Respuestas, NRespuestas),
    (NRespuestas > 0 ->
        puntaje_acumulado(Id, Respuestas, 0, PuntajeTotal),  % [RECURSIVIDAD]
        PuntosPosibles is NRespuestas * 100,
        Porcentaje is (PuntajeTotal / PuntosPosibles) * 100,
        PorcentajeRedondeado is round(Porcentaje)
    ;
        PorcentajeRedondeado is 50).  % sin respuestas = afinidad neutral

% ================================================================
% puntaje_acumulado(+Id, +Respuestas, +Acum, -Total)
% Recorre la lista de respuestas sumando el puntaje de cada criterio.
%
% [RECURSIVIDAD] — Caso base: lista vacía, devuelve el acumulado
%                   Caso recursivo: suma criterio actual + llama al resto
% ================================================================
puntaje_acumulado(_, [], Acum, Acum).                  % caso base: sin más criterios
puntaje_acumulado(Id, [Resp | Resto], Acum, Total) :-
    puntaje_criterio(Id, Resp, Puntos),                % calcula puntos de este criterio
    NuevoAcum is Acum + Puntos,
    puntaje_acumulado(Id, Resto, NuevoAcum, Total).    % [RECURSIVIDAD] procesa el resto

% ================================================================
% puntaje_criterio(+Id, +Respuesta, -Puntos)
% Asigna entre 0 y 100 puntos según qué tan bien coincide el criterio.
% ================================================================

% Género: puntos proporcionales a géneros en común (max 100)
puntaje_criterio(Id, respuesta(genero, Preferidos), Puntos) :-
    findall(G, pelicula_genero(Id, G), GenerosFilm),
    findall(GId,
        (member(GAtomo, Preferidos),
         opcion_a_genero(GAtomo, GId)),
        IdsPreferidos),
    % [LISTAS] — intersección para encontrar géneros en común
    intersection(GenerosFilm, IdsPreferidos, Comunes),
    length(Comunes, NComunes),
    length(Preferidos, NPreferidos),
    (NPreferidos > 0 ->
        Puntos is round((NComunes / NPreferidos) * 100)
    ;
        Puntos is 0).

% Época: 100 si coincide, 0 si no
puntaje_criterio(Id, respuesta(epoca, Epoca), Puntos) :-
    (pelicula(Id, _, Anio, _, _), anio_en_epoca(Anio, Epoca) ->
        Puntos = 100
    ;
        Puntos = 0).

% Tono: 100 si coincide, 0 si no
puntaje_criterio(Id, respuesta(tono, Tono), Puntos) :-
    (pelicula(Id, _, _, _, Tono) ->
        Puntos = 100
    ;
        Puntos = 0).

% Duración: 100 si coincide, 0 si no (o 50 si no hay dato)
puntaje_criterio(Id, respuesta(duracion, Rango), Puntos) :-
    (pelicula_detalle(Id, _, Dur) ->
        (duracion_en_rango(Dur, Rango) -> Puntos = 100 ; Puntos = 0)
    ;
        Puntos = 50).  % sin dato = neutral

% Idioma: 100 si coincide o es cualquiera, 0 si no
puntaje_criterio(_, respuesta(idioma, cualquiera), 100) :- !.
puntaje_criterio(Id, respuesta(idioma, Idioma), Puntos) :-
    opcion_a_idioma(Idioma, Codigo),
    (pelicula_detalle(Id, Codigo, _) -> Puntos = 100 ; Puntos = 0).

% Rating: puntos proporcionales al rating de la película
puntaje_criterio(_, respuesta(rating_min, cualquiera), 60) :- !.
puntaje_criterio(Id, respuesta(rating_min, Nivel), Puntos) :-
    opcion_a_rating(Nivel, Minimo),
    (pelicula(Id, _, _, Rating, _) ->
        (Rating >= Minimo ->
            Extra is round((Rating - Minimo) * 10),
            Puntos is min(100, 70 + Extra)
        ;
            Puntos = 0)
    ;
        Puntos = 50).

% ================================================================
% top5_recomendaciones(+Respuestas, -Top5)
% Encuentra las 5 mejores películas para las preferencias dadas.
%
% [LISTAS]       — findall construye lista de puntajes; msort ordena
% [RECURSIVIDAD] — primeros_n/3 toma los primeros 5 elementos
% ================================================================
top5_recomendaciones(Respuestas, Top5) :-
    candidatos_actuales(Respuestas, Candidatos),
    % [LISTAS] — construir lista de pares Puntaje-Id para ordenar
    findall(Puntaje-Id,
        (member(Id, Candidatos),
         puntaje_pelicula(Id, Respuestas, Puntaje)),
        ParesConPuntaje),
    msort(ParesConPuntaje, Ordenados),                 % [LISTAS] ordenar la lista
    reverse(Ordenados, Descendente),                   % [LISTAS] mayor puntaje primero
    primeros_n(5, Descendente, Top5Pares),             % [RECURSIVIDAD] tomar top 5
    % Construir lista de resultados con formato legible
    maplist(formato_resultado(Respuestas), Top5Pares, Top5).

% ================================================================
% primeros_n(+N, +Lista, -Primeros)
% Toma los primeros N elementos de una lista.
%
% [RECURSIVIDAD] — Caso base: N=0 o lista vacía devuelve []
%                   Caso recursivo: toma la cabeza y procesa el resto
% ================================================================
primeros_n(0, _, []) :- !.                             % caso base: ya tomamos N
primeros_n(_, [], []) :- !.                            % caso base: lista agotada
primeros_n(N, [H | T], [H | R]) :-
    N > 0,
    N1 is N - 1,
    primeros_n(N1, T, R).                              % [RECURSIVIDAD]

% Convierte un par Puntaje-Id a un término resultado/3
formato_resultado(Respuestas, Puntaje-Id, resultado(Id, Puntaje, Razones)) :-
    explicar_recomendacion(Id, Respuestas, Razones).

% ================================================================
% explicar_recomendacion(+Id, +Respuestas, -Razones)
% Genera la lista de razones por las que se recomienda esta película.
%
% [LISTAS]       — findall construye la lista de razones
% [RECURSIVIDAD] — razones_de_respuestas recorre la lista de respuestas
% ================================================================
explicar_recomendacion(Id, Respuestas, Razones) :-
    pelicula(Id, Titulo, Anio, Rating, _),
    % [LISTAS] — findall construye la lista de razones positivas
    findall(Razon,
        (member(Resp, Respuestas),
         razon_positiva(Id, Titulo, Anio, Rating, Resp, Razon)),
        Razones).

% Reglas para generar razones positivas (encadenamiento hacia atrás)
razon_positiva(Id, _, _, _, respuesta(genero, Preferidos), Razon) :-
    findall(G, pelicula_genero(Id, G), GenFilm),
    findall(GId, (member(GA, Preferidos), opcion_a_genero(GA, GId)), IdsP),
    intersection(GenFilm, IdsP, Comunes),
    Comunes \= [],
    % [LISTAS] — mapear IDs de géneros a nombres
    findall(Nombre,
        (member(GId, Comunes), genero(GId, Nombre)),
        NombresGeneros),
    atomic_list_concat(NombresGeneros, ', ', GenerosStr),
    format(atom(Razon), 'Comparte géneros que te gustan: ~w', [GenerosStr]).

razon_positiva(Id, _, Anio, _, respuesta(epoca, Epoca), Razon) :-
    anio_en_epoca(Anio, Epoca),
    format(atom(Razon), 'Es de la época que prefieres (~w, ~w)', [Epoca, Anio]).

razon_positiva(Id, _, _, _, respuesta(tono, Tono), Razon) :-
    pelicula(Id, _, _, _, Tono),
    format(atom(Razon), 'Tiene el tono que buscas: ~w', [Tono]).

razon_positiva(Id, _, _, _, respuesta(duracion, Rango), Razon) :-
    pelicula_detalle(Id, _, Dur),
    duracion_en_rango(Dur, Rango),
    format(atom(Razon), 'La duración (~w min) encaja con tu disponibilidad', [Dur]).

razon_positiva(Id, _, _, _, respuesta(idioma, Idioma), Razon) :-
    Idioma \= cualquiera,
    opcion_a_idioma(Idioma, Cod),
    pelicula_detalle(Id, Cod, _),
    format(atom(Razon), 'Está en el idioma que prefieres: ~w', [Idioma]).

razon_positiva(_, _, _, Rating, respuesta(rating_min, Nivel), Razon) :-
    Nivel \= cualquiera,
    opcion_a_rating(Nivel, Min),
    Rating >= Min,
    format(atom(Razon), 'Tiene excelente calificación: ~1f/10', [Rating]).

% ================================================================
% por_que_no_recomendada(+Id, +Respuestas, -Razones)
% Usa NEGACIÓN POR FALLO (\+) para encontrar por qué una película
% NO cumple los criterios del usuario.
%
% [NEGACIÓN POR FALLO] — \+ es el "not provable" de Prolog
%                         Si \+ cumple_criterio(Id, Resp) tiene éxito,
%                         significa que el criterio NO se cumplió.
% ================================================================
por_que_no_recomendada(Id, Respuestas, Razones) :-
    % [LISTAS] — findall con negación por fallo para cada respuesta
    findall(Razon,
        (member(Resp, Respuestas),
         \+ cumple_criterio(Id, Resp),               % [NEGACIÓN] no cumple el criterio
         razon_negativa(Id, Resp, Razon)),
        Razones).

% Razones de rechazo
razon_negativa(Id, respuesta(genero, Preferidos), Razon) :-
    findall(G, pelicula_genero(Id, G), GenFilm),
    findall(GId, (member(GA, Preferidos), opcion_a_genero(GA, GId)), IdsP),
    intersection(GenFilm, IdsP, []),
    atomic_list_concat(Preferidos, ', ', PStr),
    format(atom(Razon), 'No tiene géneros que te gusten (~w)', [PStr]).

razon_negativa(Id, respuesta(epoca, Epoca), Razon) :-
    pelicula(Id, _, Anio, _, _),
    \+ anio_en_epoca(Anio, Epoca),
    format(atom(Razon), 'Es de ~w, no de la época ~w que prefieres', [Anio, Epoca]).

razon_negativa(Id, respuesta(tono, Tono), Razon) :-
    pelicula(Id, _, _, _, TonoFilm),
    TonoFilm \= Tono,
    format(atom(Razon), 'Su tono es ~w, no ~w como prefieres', [TonoFilm, Tono]).

razon_negativa(Id, respuesta(duracion, Rango), Razon) :-
    pelicula_detalle(Id, _, Dur),
    \+ duracion_en_rango(Dur, Rango),
    format(atom(Razon), 'Su duración (~w min) no encaja con tu disponibilidad', [Dur]).

razon_negativa(Id, respuesta(idioma, Idioma), Razon) :-
    Idioma \= cualquiera,
    opcion_a_idioma(Idioma, Cod),
    \+ pelicula_detalle(Id, Cod, _),
    format(atom(Razon), 'No está en el idioma que prefieres (~w)', [Idioma]).

razon_negativa(Id, respuesta(rating_min, Nivel), Razon) :-
    Nivel \= cualquiera,
    opcion_a_rating(Nivel, Min),
    pelicula(Id, _, _, Rating, _),
    Rating < Min,
    format(atom(Razon), 'Su calificación (~1f) es menor a tu mínimo (~1f)', [Rating, Min]).

% ================================================================
% todos_los_rechazados(+Respuestas, -Rechazados)
% Lista todas las películas que NO quedaron en el Top5 con sus razones
%
% [LISTAS] — findall construye la lista completa de rechazadas
% ================================================================
todos_los_rechazados(Respuestas, Rechazados) :-
    top5_recomendaciones(Respuestas, Top5),
    findall(Id, member(resultado(Id, _, _), Top5), IdsTop5),
    % [LISTAS] — todas las películas que NO están en el top 5
    findall(rechazado(Id, Razones),
        (pelicula(Id, _, _, _, _),
         \+ member(Id, IdsTop5),              % [NEGACIÓN] no está en el top 5
         por_que_no_recomendada(Id, Respuestas, Razones),
         Razones \= []),                      % solo las que tienen razones claras
        Rechazados).

% ================================================================
% Predicados auxiliares (importados de arbol_preguntas pero redefinidos
% aquí para que este módulo sea autocontenido en pruebas)
% ================================================================
:- if(\+ current_predicate(anio_en_epoca/2)).
anio_en_epoca(A, clasico)   :- A < 1990.
anio_en_epoca(A, noventas)  :- A >= 1990, A < 2000.
anio_en_epoca(A, dos_miles) :- A >= 2000, A < 2010.
anio_en_epoca(A, dos_diez)  :- A >= 2010, A < 2020.
anio_en_epoca(A, reciente)  :- A >= 2020.
:- endif.

:- if(\+ current_predicate(duracion_en_rango/2)).
duracion_en_rango(D, corta)  :- D < 90.
duracion_en_rango(D, normal) :- D >= 90, D =< 120.
duracion_en_rango(D, larga)  :- D > 120.
:- endif.

:- if(\+ current_predicate(opcion_a_idioma/2)).
opcion_a_idioma(ingles,  en).
opcion_a_idioma(espanol, es).
:- endif.

:- if(\+ current_predicate(opcion_a_rating/2)).
opcion_a_rating(buena,     6.0).
opcion_a_rating(muy_buena, 7.0).
opcion_a_rating(excelente, 8.0).
:- endif.

:- if(\+ current_predicate(opcion_a_genero/2)).
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
:- endif.
