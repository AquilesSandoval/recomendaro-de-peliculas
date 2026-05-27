:- encoding(utf8).
% ================================================================
% servidor.pl — Servidor HTTP de SWI-Prolog para CineExpert
%
% Expone los endpoints que consume el backend Node.js.
% Usa library(http/thread_httpd) de SWI-Prolog.
%
% Endpoints:
%   POST /siguiente_pregunta  — siguiente pregunta adaptativa
%   POST /recomendar          — top 5 recomendaciones
%   POST /explicar            — explicación de una película
%   POST /por_que_no          — por qué no se recomienda una película
%   GET  /candidatos          — cuántos candidatos quedan
%   GET  /health              — verificar que el servidor vive
% ================================================================

:- use_module(library(http/thread_httpd)).
:- use_module(library(http/http_dispatch)).
:- use_module(library(http/http_json)).
:- use_module(library(http/json)).
:- use_module(library(http/http_parameters)).
:- use_module(library(lists)).

% Cargar los módulos de lógica
:- [hechos].
:- [arbol_preguntas].
:- [recomendador].

% ================================================================
% Registro de rutas HTTP
% ================================================================
:- http_handler('/health',              handle_health,              [method(get)]).
:- http_handler('/candidatos',          handle_candidatos,          [method(post)]).
:- http_handler('/siguiente_pregunta',  handle_siguiente_pregunta,  [method(post)]).
:- http_handler('/recomendar',          handle_recomendar,          [method(post)]).
:- http_handler('/explicar',            handle_explicar,            [method(post)]).
:- http_handler('/por_que_no',          handle_por_que_no,          [method(post)]).

% ================================================================
% Iniciar el servidor al cargar el archivo
% ================================================================
:- initialization(iniciar_servidor, main).

iniciar_servidor :-
    (getenv('PROLOG_PORT', PuertoStr) ->
        atom_number(PuertoStr, Puerto)
    ;
        Puerto = 8081),
    format("Servidor Prolog iniciando en puerto ~w~n", [Puerto]),
    http_server(http_dispatch, [port(Puerto)]),
    format("Servidor Prolog listo~n").

% ================================================================
% GET /health — verificación de vida
% ================================================================
handle_health(Request) :-
    _ = Request,
    reply_json_dict(_{ok: true, servicio: "CineExpert Prolog", version: "1.0"}).

% ================================================================
% POST /candidatos
% Body JSON: {"respuestas": [...]}
% Respuesta: {"n": 42}
% ================================================================
handle_candidatos(Request) :-
    catch(
        (   http_read_json_dict(Request, Body, []),
            get_dict(respuestas, Body, RespJSON),
            json_a_respuestas(RespJSON, Respuestas),
            candidatos_actuales(Respuestas, Candidatos),
            length(Candidatos, N),
            reply_json_dict(_{n: N})
        ),
        Error,
        responder_error(Error)
    ).

% ================================================================
% POST /siguiente_pregunta
% Body JSON: {"respuestas": [...], "preguntas_hechas": [...]}
% Respuesta: {"terminado": false, "pregunta": {...}, "candidatos": N}
%         o: {"terminado": true}
% ================================================================
handle_siguiente_pregunta(Request) :-
    catch(
        (   http_read_json_dict(Request, Body, []),
            get_dict(respuestas, Body, RespJSON),
            get_dict(preguntas_hechas, Body, PregHechasJSON),
            json_a_respuestas(RespJSON, Respuestas),
            json_a_atomos(PregHechasJSON, PreguntasHechas),
            candidatos_actuales(Respuestas, Candidatos),
            length(Candidatos, NCandidatos),
            (   (NCandidatos =< 5 ; \+ siguiente_pregunta(PreguntasHechas, Candidatos, _))
            ->  reply_json_dict(_{terminado: true, candidatos: NCandidatos})
            ;   siguiente_pregunta(PreguntasHechas, Candidatos, IdPregunta),
                pregunta(IdPregunta, Texto, Tipo, Opciones),
                opciones_a_json(IdPregunta, Opciones, OpcionesJSON),
                reply_json_dict(_{
                    terminado: false,
                    candidatos: NCandidatos,
                    pregunta: _{
                        id: IdPregunta,
                        texto: Texto,
                        tipo: Tipo,
                        opciones: OpcionesJSON
                    }
                })
            )
        ),
        Error,
        responder_error(Error)
    ).

% ================================================================
% POST /recomendar
% Body JSON: {"respuestas": [...]}
% Respuesta: {"top5": [...], "total_candidatos": N}
% ================================================================
handle_recomendar(Request) :-
    catch(
        (   http_read_json_dict(Request, Body, []),
            get_dict(respuestas, Body, RespJSON),
            json_a_respuestas(RespJSON, Respuestas),
            top5_recomendaciones(Respuestas, Top5),
            candidatos_actuales(Respuestas, Todos),
            length(Todos, NTotal),
            maplist(resultado_a_json, Top5, Top5JSON),
            reply_json_dict(_{top5: Top5JSON, total_candidatos: NTotal})
        ),
        Error,
        responder_error(Error)
    ).

% ================================================================
% POST /explicar
% Body JSON: {"id_pelicula": 550, "respuestas": [...]}
% Respuesta: {"razones": [...]}
% ================================================================
handle_explicar(Request) :-
    catch(
        (   http_read_json_dict(Request, Body, []),
            get_dict(id_pelicula, Body, Id),
            get_dict(respuestas, Body, RespJSON),
            json_a_respuestas(RespJSON, Respuestas),
            explicar_recomendacion(Id, Respuestas, Razones),
            maplist(atom_string, Razones, RazonesStr),
            reply_json_dict(_{razones: RazonesStr})
        ),
        Error,
        responder_error(Error)
    ).

% ================================================================
% POST /por_que_no
% Body JSON: {"id_pelicula": 550, "respuestas": [...]}
% Respuesta: {"razones": [...]}
% ================================================================
handle_por_que_no(Request) :-
    catch(
        (   http_read_json_dict(Request, Body, []),
            get_dict(id_pelicula, Body, Id),
            get_dict(respuestas, Body, RespJSON),
            json_a_respuestas(RespJSON, Respuestas),
            por_que_no_recomendada(Id, Respuestas, Razones),
            maplist(atom_string, Razones, RazonesStr),
            reply_json_dict(_{razones: RazonesStr})
        ),
        Error,
        responder_error(Error)
    ).

% ================================================================
% Conversión JSON <-> Términos Prolog
% ================================================================

% Convierte la lista JSON de respuestas a términos respuesta(Id, Valor)
json_a_respuestas([], []).
json_a_respuestas([RespDict | Resto], [respuesta(Id, Valor) | RestoTerms]) :-
    get_dict(pregunta, RespDict, IdStr),
    atom_string(Id, IdStr),
    get_dict(valor, RespDict, ValorJSON),
    json_valor_a_prolog(Id, ValorJSON, Valor),
    json_a_respuestas(Resto, RestoTerms).              % [RECURSIVIDAD]

% Convierte el valor JSON según el tipo de pregunta
json_valor_a_prolog(genero, Lista, Atomos) :-
    is_list(Lista), !,
    maplist(atom_string, Atomos, Lista).               % [LISTAS] convierte lista de strings

json_valor_a_prolog(_, Valor, Atomo) :-
    atom_string(Atomo, Valor).

% Convierte lista JSON de strings a átomos Prolog
json_a_atomos([], []).
json_a_atomos([H | T], [A | R]) :-
    atom_string(A, H),
    json_a_atomos(T, R).                               % [RECURSIVIDAD]

% Convierte las opciones de una pregunta a JSON
opciones_a_json(genero, Opciones, OpcionesJSON) :-
    maplist(opcion_genero_a_json, Opciones, OpcionesJSON).

opciones_a_json(_, Opciones, OpcionesJSON) :-
    maplist(opcion_simple_a_json, Opciones, OpcionesJSON).

opcion_genero_a_json(Atomo, json{valor: ValorStr, etiqueta: EtiquetaStr}) :-
    atom_string(Atomo, ValorStr),
    opcion_etiqueta(Atomo, Etiqueta),
    atom_string(Etiqueta, EtiquetaStr).

opcion_simple_a_json(Atomo, json{valor: ValorStr, etiqueta: EtiquetaStr}) :-
    atom_string(Atomo, ValorStr),
    opcion_etiqueta(Atomo, Etiqueta),
    atom_string(Etiqueta, EtiquetaStr).

% Convierte un término resultado/3 a JSON
resultado_a_json(resultado(Id, Puntaje, Razones),
    json{id_tmdb: Id, afinidad: Puntaje, razones: RazonesStr}) :-
    maplist(atom_string, Razones, RazonesStr).

% Responder con error en JSON
responder_error(Error) :-
    term_string(Error, ErrorStr),
    reply_json_dict(_{error: ErrorStr}, [status(500)]).

% ================================================================
% Etiquetas legibles para las opciones
% ================================================================
opcion_etiqueta(accion,      'Acción').
opcion_etiqueta(aventura,    'Aventura').
opcion_etiqueta(comedia,     'Comedia').
opcion_etiqueta(drama,       'Drama').
opcion_etiqueta(terror,      'Terror').
opcion_etiqueta(sci_fi,      'Ciencia Ficción').
opcion_etiqueta(animacion,   'Animación').
opcion_etiqueta(romance,     'Romance').
opcion_etiqueta(thriller,    'Thriller').
opcion_etiqueta(documental,  'Documental').
opcion_etiqueta(clasico,     'Clásico (antes de 1990)').
opcion_etiqueta(noventas,    'Los 90s').
opcion_etiqueta(dos_miles,   'Los 2000s').
opcion_etiqueta(dos_diez,    'Los 2010s').
opcion_etiqueta(reciente,    'Reciente (2020+)').
opcion_etiqueta(ligero,      'Ligero y divertido').
opcion_etiqueta(moderado,    'Entretenido y equilibrado').
opcion_etiqueta(serio,       'Serio y reflexivo').
opcion_etiqueta(oscuro,      'Oscuro e intenso').
opcion_etiqueta(corta,       'Corta (menos de 90 min)').
opcion_etiqueta(normal,      'Normal (90-120 min)').
opcion_etiqueta(larga,       'Larga (más de 120 min)').
opcion_etiqueta(ingles,      'Inglés').
opcion_etiqueta(espanol,     'Español').
opcion_etiqueta(cualquiera,  'Cualquier idioma').
opcion_etiqueta(buena,       'Buena (≥6.0)').
opcion_etiqueta(muy_buena,   'Muy buena (≥7.0)').
opcion_etiqueta(excelente,   'Excelente (≥8.0)').
