-- Faz 4: ücretsiz plan müşteri kapısı.
--
-- Ayrı dosya: faturalama istemeyen starter kit alıcısı yalnızca bunu siler
-- (DEC-PAY-12). WITH CHECK yalnızca INSERT'e uygulanır — UPDATE'e dokunulmaz,
-- yoksa kapı devreye girdiğinde mevcut müşteriler salt okunur olurdu.

drop policy "Kullanici kendi musterilerini olusturabilir" on public.clients;

create policy "Kullanici kendi musterilerini olusturabilir"
  on public.clients for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      public.is_pro(auth.uid())
      or public.client_count(auth.uid()) < 1
    )
  );
