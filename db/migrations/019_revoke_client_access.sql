-- MOO-23 (auditoria 20/11): as tabelas criadas em 001, 002 e 005 não têm RLS
-- nem REVOKE explícito; a única barreira era o schema `moont` não estar
-- exposto à API do Supabase. O app acessa o banco só pelo servidor (papel
-- postgres), então nada disto muda o comportamento do app.
-- Os papéis anon/authenticated só existem no Supabase; no PGlite dos testes o
-- bloco não faz nada.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA moont FROM anon, authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA moont FROM anon, authenticated;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA moont FROM anon, authenticated;
    REVOKE ALL ON SCHEMA moont FROM anon, authenticated;
    -- Tabela, sequência ou função nova criada pelo app em `moont` ou em
    -- `public` não nasce gravável pelo cliente.
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA moont REVOKE ALL ON TABLES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA moont REVOKE ALL ON SEQUENCES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA moont REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
  END IF;
END $$;
