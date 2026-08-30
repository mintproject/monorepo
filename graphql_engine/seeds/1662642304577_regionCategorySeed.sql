INSERT INTO public.region_category (id, name, citation) VALUES ('administrative', 'Administrative', NULL);
INSERT INTO public.region_category (id, name, citation) VALUES ('agriculture', 'Agriculture', NULL);
INSERT INTO public.region_category (id, name, citation) VALUES ('hydrology', 'Hydrology', NULL);
INSERT INTO public.region_category (id, name, citation) VALUES ('watersheds', 'Watersheds', 'Citations and acknowledgements of the HydroBASINS data should be made as follows: Lehner, B., Grill G. (2013): Global river hydrography and network routing: baseline data and new approaches to study the world''s large river systems. Hydrological Processes, 27(15): 2171-2186. Data is available at www.hydrosheds.org.');
INSERT INTO public.region_category (id, name, citation) VALUES ('administrative_level_2', 'Administrative Level 2', NULL);
INSERT INTO public.region_category (id, name, citation) VALUES ('administrative_level_3', 'Administrative Level 3', NULL);
INSERT INTO public.region_category_tree (region_category_id, region_category_parent_id) VALUES ('administrative_level_2', 'administrative');
INSERT INTO public.region_category_tree (region_category_id, region_category_parent_id) VALUES ('administrative_level_3', 'administrative');
INSERT INTO public.region_category_tree (region_category_id, region_category_parent_id) VALUES ('watersheds', 'hydrology');
--
