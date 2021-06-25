--
-- PostgreSQL database dump
--

-- Dumped from database version 11.8
-- Dumped by pg_dump version 11.8

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: intervention; Type: TABLE DATA; Schema: public; Owner: hasurauser
--

COPY public.intervention (id, name, description) FROM stdin;
weed_control	Weed control	Interventions concerning weed control and weed management practices can be reflected in the model by indicating the fraction of weeds that will remain after the weed treatments applied by farmers
planting_windows	Planting windows	Interventions that force specific target planting windows can be expressed in this model as start and end planting dates
fertilizer_subsidies	Fertilizer Subsidies	Interventions concerning fertilizer subsidies can be expressed in this model as a percentage of fertilizer prices
\.


--
-- PostgreSQL database dump complete
--

