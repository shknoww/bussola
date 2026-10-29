-- Apply ONCE as a database administrator. No fixtures; no existing tables/configuration are changed.
-- Schema creation deliberately fails on reapplication. The scoped role is shared across isolated databases.
BEGIN;
DO $role$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='bussola_api') THEN
  CREATE ROLE bussola_api NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
 ELSIF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='bussola_api' AND (rolsuper OR rolcanlogin OR rolcreatedb OR rolcreaterole OR rolinherit OR rolreplication OR rolbypassrls))
 OR EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='bussola_api')) THEN
  RAISE EXCEPTION 'Existing bussola_api role is not narrowly scoped';
 END IF;
END $role$;
CREATE SCHEMA bussola;
REVOKE ALL ON SCHEMA bussola FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO bussola_api;
DO $setup$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'authenticator') THEN
    GRANT bussola_api TO authenticator;
  END IF;
END $setup$;

CREATE FUNCTION bussola.valid_text(v jsonb, max_length integer, required boolean DEFAULT false)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
 SELECT CASE WHEN v IS NULL OR v = 'null'::jsonb THEN NOT required
 ELSE jsonb_typeof(v) = 'string' AND length(v #>> '{}') <= max_length
 AND (NOT required OR length(btrim(v #>> '{}')) > 0)
 AND (v #>> '{}') !~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]' END
$$;
CREATE FUNCTION bussola.valid_url(v text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
 SELECT v IS NULL OR v = '' OR (length(v) <= 2048 AND v ~ '^https://[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]{1,5})?([/?#][^[:space:]]*)?$' AND v !~ '^https://[^/?#]*@')
$$;
CREATE FUNCTION bussola.valid_uuid(v text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
 SELECT coalesce(v ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',false)
$$;
CREATE FUNCTION bussola.fold(v text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
 SELECT translate(lower(coalesce(v,'')), 'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ', 'aaaaaaeeeeiiiiooooouuuucnyy')
$$;
CREATE FUNCTION bussola.valid_iso(v jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog AS $$
BEGIN
 IF v IS NULL OR v = 'null'::jsonb THEN RETURN true; END IF;
 IF jsonb_typeof(v) <> 'string' OR (v #>> '{}') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$' THEN RETURN false; END IF;
 PERFORM (v #>> '{}')::timestamptz;
 RETURN true;
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN false;
END $$;
CREATE FUNCTION bussola.validate(p jsonb, mode text) RETURNS void LANGUAGE plpgsql SET search_path = pg_catalog,bussola AS $$
DECLARE directional boolean; allowed text[];
BEGIN
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid_request' USING ERRCODE='22023'; END IF;
 IF mode = 'correction' THEN
  allowed := ARRAY['idempotency_key','establishment_id','reason','notes','website'];
  IF NOT bussola.valid_uuid(p->>'idempotency_key') OR NOT bussola.valid_uuid(p->>'establishment_id')
     OR coalesce(p->>'reason','') NOT IN ('address','unit','source','outdated','association','other')
     OR NOT bussola.valid_text(p->'notes',4000,true) OR coalesce(p->>'website','') <> '' THEN
    RAISE EXCEPTION 'invalid_request' USING ERRCODE='22023'; END IF;
 ELSE
  allowed := ARRAY['name','category','city','state','address','neighbourhood','unit','position','source_url'];
  IF NOT bussola.valid_text(p->'name',160,true) OR coalesce(p->>'category','') NOT IN ('cafe','restaurant','bookshop','bar','shop','other')
     OR NOT bussola.valid_text(p->'city',120,true) OR NOT bussola.valid_text(p->'state',80,true)
     OR NOT bussola.valid_text(p->'address',300,true) OR NOT bussola.valid_text(p->'neighbourhood',120)
     OR NOT bussola.valid_text(p->'unit',120) OR coalesce(p->>'position','') NOT IN ('left','right','unknown')
     OR NOT bussola.valid_text(p->'source_url',2048) OR NOT bussola.valid_url(p->>'source_url') THEN
    RAISE EXCEPTION 'invalid_request' USING ERRCODE='22023'; END IF;
  directional := p->>'position' <> 'unknown';
  IF directional AND coalesce(p->>'source_url','') = '' THEN RAISE EXCEPTION 'invalid_request' USING ERRCODE='22023'; END IF;
  IF mode = 'submission' THEN
   allowed := allowed || ARRAY['idempotency_key','notes','website'];
   IF NOT bussola.valid_uuid(p->>'idempotency_key') OR NOT bussola.valid_text(p->'notes',4000) OR coalesce(p->>'website','') <> '' THEN
    RAISE EXCEPTION 'invalid_request' USING ERRCODE='22023'; END IF;
  ELSIF mode = 'place' THEN
   allowed := allowed || ARRAY['lat','lng','source_type','source_scope','source_published_at','source_verified','review_due_at','customer_statement'];
   IF jsonb_typeof(p->'lat') IS DISTINCT FROM 'number' OR jsonb_typeof(p->'lng') IS DISTINCT FROM 'number'
      OR (p->>'lat')::numeric NOT BETWEEN -90 AND 90 OR (p->>'lng')::numeric NOT BETWEEN -180 AND 180
      OR NOT bussola.valid_text(p->'source_scope',500) OR NOT bussola.valid_text(p->'customer_statement',1000)
      OR (p->>'source_type' IS NOT NULL AND p->>'source_type' NOT IN ('direct','third_party'))
      OR jsonb_typeof(p->'source_verified') IS DISTINCT FROM 'boolean'
      OR NOT bussola.valid_iso(p->'source_published_at') OR NOT bussola.valid_iso(p->'review_due_at') THEN
     RAISE EXCEPTION 'invalid_request' USING ERRCODE='22023'; END IF;
   IF (p->>'source_published_at')::timestamptz > statement_timestamp() THEN RAISE EXCEPTION 'invalid_request' USING ERRCODE='22023'; END IF;
   IF directional OR length(coalesce(p->>'customer_statement','')) > 0 THEN
    IF coalesce(p->>'source_url','') = '' OR coalesce(p->>'source_type','') <> 'direct'
       OR p->'source_verified' IS DISTINCT FROM 'true'::jsonb OR length(btrim(coalesce(p->>'source_scope',''))) = 0
       OR coalesce((p->>'review_due_at')::timestamptz, '-infinity'::timestamptz) <= statement_timestamp() THEN
      RAISE EXCEPTION 'invalid_request' USING ERRCODE='22023'; END IF;
   END IF;
  ELSE RAISE EXCEPTION 'invalid_request' USING ERRCODE='22023';
  END IF;
 END IF;
 IF p - allowed <> '{}'::jsonb THEN RAISE EXCEPTION 'invalid_request' USING ERRCODE='22023'; END IF;
END $$;

CREATE TABLE bussola.establishments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 data jsonb NOT NULL CHECK (jsonb_typeof(data)='object'),
 status text NOT NULL DEFAULT 'published' CHECK (status IN ('published','archived')),
 assertion_status text NOT NULL DEFAULT 'active' CHECK (assertion_status IN ('active','suspended')),
 revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
 reviewed_by text NOT NULL DEFAULT 'owner',
 verified_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT statement_timestamp()
);
CREATE TABLE bussola.contributions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 idempotency_key uuid NOT NULL UNIQUE,
 kind text NOT NULL CHECK (kind IN ('submission','correction')),
 establishment_id uuid REFERENCES bussola.establishments(id),
 target_revision integer,
 payload jsonb NOT NULL CHECK (jsonb_typeof(payload)='object'),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','rejected','needs_info','resolved')),
 revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
 created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 CHECK ((kind='submission') OR (establishment_id IS NOT NULL AND target_revision IS NOT NULL))
);
CREATE TABLE bussola.moderation_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor text NOT NULL CHECK (actor='owner'),
 kind text NOT NULL CHECK (kind IN ('submission','correction','establishment')),
 entity_id uuid NOT NULL,
 action text NOT NULL,
 reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 2000),
 before_data jsonb,
 after_data jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT statement_timestamp()
);
CREATE TABLE bussola.rate_limits (
 purpose text NOT NULL CHECK (purpose IN ('login','submission','correction')),
 key_hash text NOT NULL CHECK (key_hash ~ '^[a-f0-9]{64}$'),
 window_start timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 hits integer NOT NULL CHECK (hits > 0),
 PRIMARY KEY (purpose,key_hash,window_start)
);
CREATE INDEX bussola_rate_expiry ON bussola.rate_limits(expires_at);
CREATE INDEX bussola_queue ON bussola.contributions(status,created_at,id);
CREATE INDEX bussola_establishment_order ON bussola.establishments(bussola.fold(data->>'name'),id) WHERE status='published';
CREATE INDEX bussola_establishment_city ON bussola.establishments(bussola.fold(data->>'city')) WHERE status='published';
CREATE INDEX bussola_establishment_coordinates ON bussola.establishments(((data->>'lat')::numeric),((data->>'lng')::numeric)) WHERE status='published';
CREATE INDEX bussola_audit_order ON bussola.moderation_events(created_at,id);
ALTER TABLE bussola.establishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE bussola.contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bussola.moderation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE bussola.rate_limits ENABLE ROW LEVEL SECURITY;
-- No RLS policies: direct access is denied. Only the owner SECURITY DEFINER gateway accesses tables.

CREATE FUNCTION bussola.check_place() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,bussola AS $$
BEGIN
 -- Updates that only suspend/archive need not revalidate a now-expired assertion.
 IF TG_OP='INSERT' OR NEW.data IS DISTINCT FROM OLD.data THEN PERFORM bussola.validate(NEW.data,'place'); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER bussola_check_place BEFORE INSERT OR UPDATE ON bussola.establishments FOR EACH ROW EXECUTE FUNCTION bussola.check_place();
CREATE FUNCTION bussola.check_contribution() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,bussola AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  PERFORM bussola.validate(NEW.payload || jsonb_build_object('idempotency_key',NEW.idempotency_key) || CASE WHEN NEW.kind='correction' THEN jsonb_build_object('establishment_id',NEW.establishment_id) ELSE '{}'::jsonb END, NEW.kind);
 ELSIF NEW.payload IS DISTINCT FROM OLD.payload OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key OR NEW.kind IS DISTINCT FROM OLD.kind THEN
  RAISE EXCEPTION 'immutable_contribution' USING ERRCODE='22023';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER bussola_check_contribution BEFORE INSERT OR UPDATE ON bussola.contributions FOR EACH ROW EXECUTE FUNCTION bussola.check_contribution();
CREATE FUNCTION bussola.public_place(e bussola.establishments) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=pg_catalog,bussola SET timezone='UTC' AS $$
DECLARE d jsonb := e.data; state text; current_source boolean;
BEGIN
 IF e.status <> 'published' THEN RETURN NULL; END IF;
 state := CASE WHEN e.assertion_status='suspended' THEN 'suspended'
  WHEN d->>'position'='unknown' AND coalesce(d->>'customer_statement','')='' THEN 'none'
  WHEN (d->>'review_due_at')::timestamptz <= statement_timestamp() THEN 'expired' ELSE 'current' END;
 current_source := state='current';
 RETURN jsonb_build_object('id',e.id,'name',d->>'name','category',d->>'category','city',d->>'city','state',d->>'state',
  'address',d->>'address','neighbourhood',coalesce(d->>'neighbourhood',''),'unit',coalesce(d->>'unit',''),
  'lat',(d->>'lat')::numeric,'lng',(d->>'lng')::numeric,'position',CASE WHEN current_source THEN d->>'position' ELSE 'unknown' END,
  'review_state',state,'source_url',CASE WHEN current_source THEN d->>'source_url' END,
  'source_type',CASE WHEN current_source THEN d->>'source_type' END,'source_scope',CASE WHEN current_source THEN d->>'source_scope' END,
  'source_published_at',CASE WHEN current_source THEN d->>'source_published_at' END,
  'verified_at',CASE WHEN state<>'none' THEN e.verified_at END,'review_due_at',CASE WHEN state<>'none' THEN d->>'review_due_at' END,
  'customer_statement',CASE WHEN current_source THEN nullif(d->>'customer_statement','') END,'revision',e.revision);
END $$;

CREATE FUNCTION bussola.query(p jsonb) RETURNS SETOF jsonb LANGUAGE plpgsql STABLE SET search_path=pg_catalog,bussola AS $$
DECLARE box jsonb := p->'bbox'; ids jsonb := p->'ids';
BEGIN
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR p - ARRAY['q','city','category','position','bbox','offset','ids'] <> '{}'::jsonb
    OR NOT bussola.valid_text(p->'q',160) OR NOT bussola.valid_text(p->'city',120)
    OR coalesce(p->>'category','') NOT IN ('','cafe','restaurant','bookshop','bar','shop','other')
    OR coalesce(p->>'position','all') NOT IN ('all','left','right','unknown')
    OR (p ? 'offset' AND (jsonb_typeof(p->'offset') <> 'number' OR p->>'offset' !~ '^\d{1,9}$')) THEN
  RAISE EXCEPTION 'invalid_request' USING ERRCODE='22023'; END IF;
 IF box IS NOT NULL THEN
  IF jsonb_typeof(box) <> 'array' THEN RAISE EXCEPTION 'invalid_request' USING ERRCODE='22023'; END IF;
  IF jsonb_array_length(box)<>4 OR EXISTS(SELECT 1 FROM jsonb_array_elements(box) v WHERE jsonb_typeof(v)<>'number') THEN RAISE EXCEPTION 'invalid_request' USING ERRCODE='22023'; END IF;
  IF (box->>0)::numeric < -180 OR (box->>2)::numeric > 180 OR (box->>0)::numeric > (box->>2)::numeric
     OR (box->>1)::numeric < -90 OR (box->>3)::numeric > 90 OR (box->>1)::numeric > (box->>3)::numeric THEN RAISE EXCEPTION 'invalid_request' USING ERRCODE='22023'; END IF;
 END IF;
 IF ids IS NOT NULL THEN
  IF jsonb_typeof(ids)<>'array' THEN RAISE EXCEPTION 'invalid_request' USING ERRCODE='22023'; END IF;
  IF jsonb_array_length(ids)>200 OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(ids) v WHERE NOT bussola.valid_uuid(v)) THEN RAISE EXCEPTION 'invalid_request' USING ERRCODE='22023'; END IF;
 END IF;
 RETURN QUERY
 WITH projected AS (SELECT bussola.public_place(e) AS d FROM bussola.establishments e WHERE e.status='published')
 SELECT d FROM projected
 WHERE (coalesce(p->>'city','')='' OR bussola.fold(d->>'city')=bussola.fold(p->>'city'))
 AND (coalesce(p->>'category','')='' OR d->>'category'=p->>'category')
 AND (coalesce(p->>'position','all')='all' OR d->>'position'=p->>'position')
 AND (coalesce(p->>'q','')='' OR strpos(bussola.fold(concat_ws(' ',d->>'name',d->>'neighbourhood',d->>'category',
   CASE d->>'category' WHEN 'restaurant' THEN 'restaurante' WHEN 'bookshop' THEN 'livraria' WHEN 'shop' THEN 'loja' WHEN 'other' THEN 'outro' ELSE '' END)),bussola.fold(p->>'q'))>0)
 AND (box IS NULL OR ((d->>'lng')::numeric BETWEEN (box->>0)::numeric AND (box->>2)::numeric AND (d->>'lat')::numeric BETWEEN (box->>1)::numeric AND (box->>3)::numeric))
 AND (ids IS NULL OR ids ? (d->>'id'));
END $$;

CREATE FUNCTION public.bussola_gateway(op text,payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,bussola SET timezone='UTC' AS $gateway$
#variable_conflict use_variable
DECLARE p jsonb := payload; c bussola.contributions; e bussola.establishments; previous jsonb; result jsonb;
 n bigint; off integer; items jsonb; start_at timestamptz; duration integer; ceiling integer; hits integer;
 entity uuid; target uuid; kind text; action text; expected integer; rev integer; snapshot jsonb;
BEGIN
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR octet_length(p::text)>32768 THEN RETURN jsonb_build_object('error','invalid_request'); END IF;
 IF op='health' THEN RETURN jsonb_build_object('ok',true,'database',true); END IF;
 IF op='rate_limit' THEN
  IF p - ARRAY['purpose','key'] <> '{}'::jsonb OR coalesce(p->>'purpose','') NOT IN ('login','submission','correction') OR coalesce(p->>'key','') !~ '^[a-f0-9]{64}$' THEN RETURN jsonb_build_object('error','invalid_request'); END IF;
  duration := CASE WHEN p->>'purpose'='login' THEN 900 ELSE 3600 END;
  ceiling := 10;
  start_at := to_timestamp(floor(extract(epoch FROM statement_timestamp())/duration)*duration);
  -- Opportunistic physical deletion; logical windows expire even when no cleanup traffic occurs.
  DELETE FROM bussola.rate_limits WHERE expires_at <= statement_timestamp();
  INSERT INTO bussola.rate_limits AS r(purpose,key_hash,window_start,expires_at,hits)
   VALUES(p->>'purpose',p->>'key',start_at,start_at + make_interval(secs=>duration),1)
   ON CONFLICT(purpose,key_hash,window_start) DO UPDATE SET hits=least(r.hits+1,1000000) RETURNING r.hits INTO hits;
  RETURN jsonb_build_object('allowed',hits<=ceiling);
 END IF;
 IF op='list' THEN
  off := coalesce((p->>'offset')::integer,0);
  WITH matches AS MATERIALIZED (SELECT d FROM bussola.query(p) d), page AS
   (SELECT d FROM matches ORDER BY bussola.fold(d->>'name'),d->>'id' OFFSET off LIMIT 50)
  SELECT (SELECT count(*) FROM matches),coalesce(jsonb_agg(d ORDER BY bussola.fold(d->>'name'),d->>'id'),'[]'::jsonb) INTO n,items FROM page;
  RETURN jsonb_build_object('items',items,'total',n,'next_offset',CASE WHEN off+50<n THEN off+50 END,'queried_at',statement_timestamp());
 END IF;
 IF op='map' THEN
  WITH matches AS MATERIALIZED (SELECT d FROM bussola.query(p) d), bounds AS
   (SELECT count(*) AS total,min((d->>'lng')::numeric) AS w,max((d->>'lng')::numeric) AS e,min((d->>'lat')::numeric) AS s,max((d->>'lat')::numeric) AS n FROM matches),
  cells AS (SELECT m.d,least(19,floor(20*((d->>'lng')::numeric-b.w)/coalesce(nullif(b.e-b.w,0),1))) AS x,
    least(9,floor(10*((d->>'lat')::numeric-b.s)/coalesce(nullif(b.n-b.s,0),1))) AS y FROM matches m CROSS JOIN bounds b),
  groups AS (SELECT x,y,jsonb_build_object('cluster',true,'lat',avg((d->>'lat')::numeric),'lng',avg((d->>'lng')::numeric),'count',count(*)) AS d FROM cells GROUP BY x,y)
  SELECT total,CASE WHEN total<=200 THEN (SELECT coalesce(jsonb_agg(d ORDER BY bussola.fold(d->>'name'),d->>'id'),'[]'::jsonb) FROM matches)
    ELSE (SELECT coalesce(jsonb_agg(d ORDER BY x,y),'[]'::jsonb) FROM groups) END INTO n,items FROM bounds;
  RETURN jsonb_build_object('items',items,'total',n,'clustered',n>200);
 END IF;
 IF op='cities' THEN
  RETURN jsonb_build_object('items',coalesce((SELECT jsonb_agg(city ORDER BY bussola.fold(city),city) FROM (SELECT DISTINCT data->>'city' city FROM bussola.establishments WHERE status='published') x),'[]'::jsonb));
 END IF;
 IF op='detail' THEN
  IF NOT bussola.valid_uuid(p->>'id') THEN RETURN jsonb_build_object('error','invalid_request'); END IF;
  SELECT bussola.public_place(x) INTO result FROM bussola.establishments x WHERE x.id=(p->>'id')::uuid AND x.status='published';
  RETURN coalesce(result,jsonb_build_object('error','not_found'));
 END IF;
 IF op IN ('submit','correct') THEN
  kind := CASE WHEN op='submit' THEN 'submission' ELSE 'correction' END;
  PERFORM bussola.validate(p,kind);
  -- Serializes same-key concurrent requests before comparing canonical JSONB payloads.
  PERFORM pg_advisory_xact_lock(hashtextextended(p->>'idempotency_key',784159));
  SELECT * INTO c FROM bussola.contributions WHERE idempotency_key=(p->>'idempotency_key')::uuid;
  IF FOUND THEN
   IF c.kind<>kind OR c.payload IS DISTINCT FROM (p - ARRAY['idempotency_key','establishment_id']) OR c.establishment_id IS DISTINCT FROM (CASE WHEN kind='correction' THEN (p->>'establishment_id')::uuid ELSE c.establishment_id END) THEN
    RETURN jsonb_build_object('error','idempotency_conflict'); END IF;
   -- Stable original acknowledgement, even after moderation: no queue state disclosure.
   RETURN jsonb_build_object('id',c.id,'status','pending');
  END IF;
  IF kind='correction' THEN
   SELECT * INTO e FROM bussola.establishments WHERE id=(p->>'establishment_id')::uuid AND status='published' FOR SHARE;
   IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;
  END IF;
  INSERT INTO bussola.contributions(idempotency_key,kind,establishment_id,target_revision,payload)
   VALUES((p->>'idempotency_key')::uuid,kind,e.id,e.revision,p - ARRAY['idempotency_key','establishment_id']) RETURNING * INTO c;
  RETURN jsonb_build_object('id',c.id,'status','pending');
 END IF;
 IF op='queue' THEN
  RETURN jsonb_build_object(
   'submissions',coalesce((SELECT jsonb_agg(to_jsonb(c_row) - 'idempotency_key' || jsonb_build_object('possible_duplicates',coalesce((SELECT jsonb_agg(e_row.id ORDER BY e_row.id) FROM bussola.establishments e_row WHERE bussola.fold(e_row.data->>'name')=bussola.fold(c_row.payload->>'name') AND bussola.fold(e_row.data->>'address')=bussola.fold(c_row.payload->>'address')),'[]'::jsonb)) ORDER BY c_row.created_at,c_row.id) FROM bussola.contributions c_row WHERE c_row.kind='submission'),'[]'::jsonb),
   'corrections',coalesce((SELECT jsonb_agg(to_jsonb(c_row) - 'idempotency_key' ORDER BY c_row.created_at,c_row.id) FROM bussola.contributions c_row WHERE c_row.kind='correction'),'[]'::jsonb),
   'establishments',coalesce((SELECT jsonb_agg(jsonb_build_object('id',e_row.id,'revision',e_row.revision,'status',e_row.status,'created_at',e_row.created_at,'payload',e_row.data,'assertion_status',e_row.assertion_status,'verified_at',e_row.verified_at) ORDER BY e_row.created_at,e_row.id) FROM bussola.establishments e_row),'[]'::jsonb));
 END IF;
 IF op='audit' THEN RETURN jsonb_build_object('items',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC,a.id) FROM bussola.moderation_events a),'[]'::jsonb)); END IF;
 IF op='decision' THEN
  kind := p->>'kind'; action := p->>'action';
  IF p - ARRAY['kind','id','expected_revision','action','reason','place'] <> '{}'::jsonb
    OR NOT bussola.valid_uuid(p->>'id') OR NOT bussola.valid_text(p->'reason',2000,true)
    OR jsonb_typeof(p->'expected_revision') IS DISTINCT FROM 'number' OR coalesce(p->>'expected_revision','') !~ '^[1-9][0-9]{0,9}$'
    OR coalesce(kind,'') NOT IN ('submission','correction','establishment') OR coalesce(action,'') NOT IN ('publish','reject','needs_info','suspend','archive','maintain')
    OR (kind='submission' AND action NOT IN ('publish','reject','needs_info'))
    OR (kind='establishment' AND action NOT IN ('publish','suspend','archive','maintain'))
    OR (action<>'publish' AND p ? 'place') THEN RETURN jsonb_build_object('error','invalid_request'); END IF;
  entity := (p->>'id')::uuid; expected := (p->>'expected_revision')::integer;
  IF action='publish' THEN PERFORM bussola.validate(p->'place','place'); END IF;
  IF kind='establishment' THEN
   SELECT * INTO e FROM bussola.establishments WHERE id=entity FOR UPDATE;
   IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;
   IF e.revision<>expected THEN RETURN jsonb_build_object('error','revision_conflict'); END IF;
   target := e.id; previous := jsonb_build_object('establishment',to_jsonb(e));
  ELSE
   SELECT * INTO c FROM bussola.contributions WHERE id=entity AND contributions.kind=kind FOR UPDATE;
   IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;
   IF c.revision<>expected OR c.status NOT IN ('pending','needs_info') THEN RETURN jsonb_build_object('error','revision_conflict'); END IF;
   previous := jsonb_build_object('contribution',to_jsonb(c)); target := c.establishment_id;
   IF kind='correction' THEN
    SELECT * INTO e FROM bussola.establishments WHERE id=target FOR UPDATE;
    previous := previous || jsonb_build_object('establishment',to_jsonb(e));
    IF action IN ('publish','suspend','archive') AND e.revision<>c.target_revision THEN RETURN jsonb_build_object('error','revision_conflict'); END IF;
   END IF;
  END IF;
  IF action='publish' THEN
   IF kind='submission' THEN
    INSERT INTO bussola.establishments(data) VALUES(p->'place') RETURNING * INTO e; target := e.id;
   ELSE
    UPDATE bussola.establishments SET data=p->'place',status='published',assertion_status='active',revision=revision+1,verified_at=statement_timestamp(),updated_at=statement_timestamp(),reviewed_by='owner' WHERE id=target RETURNING * INTO e;
   END IF;
  ELSIF action IN ('suspend','archive') THEN
   UPDATE bussola.establishments SET assertion_status=CASE WHEN action='suspend' THEN 'suspended' ELSE assertion_status END,
    status=CASE WHEN action='archive' THEN 'archived' ELSE status END,revision=revision+1,updated_at=statement_timestamp() WHERE id=target RETURNING * INTO e;
  ELSIF kind='establishment' AND action='maintain' THEN
   UPDATE bussola.establishments SET revision=revision+1,updated_at=statement_timestamp() WHERE id=target RETURNING * INTO e;
  END IF;
  IF kind<>'establishment' THEN
   UPDATE bussola.contributions SET status=CASE WHEN action='publish' AND kind='submission' THEN 'published' WHEN action='reject' THEN 'rejected' WHEN action='needs_info' THEN 'needs_info' ELSE 'resolved' END,
    establishment_id=coalesce(target,establishment_id),revision=revision+1,updated_at=statement_timestamp() WHERE id=entity RETURNING * INTO c;
   rev := c.revision;
  ELSE rev := e.revision; END IF;
  snapshot := jsonb_build_object('establishment',CASE WHEN e.id IS NOT NULL THEN to_jsonb(e) END,'contribution',CASE WHEN c.id IS NOT NULL THEN to_jsonb(c) END);
  INSERT INTO bussola.moderation_events(actor,kind,entity_id,action,reason,before_data,after_data) VALUES('owner',kind,entity,action,p->>'reason',previous,snapshot);
  RETURN jsonb_build_object('ok',true,'id',coalesce(target,entity),'revision',rev);
 END IF;
 RETURN jsonb_build_object('error','invalid_request');
EXCEPTION WHEN invalid_parameter_value OR invalid_text_representation OR numeric_value_out_of_range OR invalid_datetime_format OR datetime_field_overflow OR check_violation OR not_null_violation THEN
 RETURN jsonb_build_object('error','invalid_request');
END $gateway$;

REVOKE ALL ON ALL TABLES IN SCHEMA bussola FROM PUBLIC,bussola_api;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA bussola FROM PUBLIC,bussola_api;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA bussola FROM PUBLIC,bussola_api;
REVOKE ALL ON FUNCTION public.bussola_gateway(text,jsonb) FROM PUBLIC;
DO $grants$ DECLARE role_name text; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON FUNCTION public.bussola_gateway(text,jsonb) FROM %I',role_name);
   EXECUTE format('REVOKE ALL ON SCHEMA bussola FROM %I',role_name);
   EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA bussola FROM %I',role_name);
   EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA bussola FROM %I',role_name);
  END IF;
 END LOOP;
END $grants$;
GRANT EXECUTE ON FUNCTION public.bussola_gateway(text,jsonb) TO bussola_api;
COMMIT;
