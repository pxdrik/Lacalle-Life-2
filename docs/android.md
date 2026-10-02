# App Android (APK)

O app Android é o site oficial dentro de um WebView (Capacitor 8). O APK não
carrega o site dentro dele: abre `https://lacalle-life-2.vercel.app`, então
cada publicação do site (`main`) chega ao app sem APK novo. Só é preciso gerar
um APK novo quando muda algo do próprio app: ícone, nome, abertura, versão do
Capacitor, permissões, ou o endereço que ele abre.

Por que não empacotar o site dentro do APK: a arquitetura do app (middleware
por requisição, rotas dinâmicas com id local, sessão por cookie) não aceita
export estático (auditoria de 25/09/2026, `capacitor.config.ts`).

## O que o app faz além do site

- **Ícone e abertura da marca**, gerados de `src/app/icon.svg` por
  `node scripts/build-android-icons.mjs` (ícone adaptativo, monocromático do
  Android 13 e os antigos). A abertura é o símbolo no verde da marca sobre o
  fundo do app, no tema do aparelho (`res/values` e `res/values-night`).
- **Barras do sistema**: no Android 15 o app desenha por baixo da barra de
  status, e o site não reserva espaço no topo. `MainActivity` afasta a página
  das barras, do recorte da câmera e do teclado; atrás delas fica o fundo do
  app, e os ícones da barra seguem o tema do aparelho (não o escolhido dentro
  do app). Por isso o `SystemBars` do Capacitor está com `insetsHandling:
  "disable"`.

## Gerar o APK

No Git Bash, a partir de `android/`:

```sh
export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"
npx cap sync android          # na raiz, depois de mudar capacitor.config.ts
./gradlew assembleRelease
```

Sai em `android/app/build/outputs/apk/release/app-release.apk`, assinado.
Antes de gerar uma versão nova para instalar por cima, subir `versionCode` (+1)
e `versionName` em `android/app/build.gradle`: o Android só atualiza com
`versionCode` maior.

## A chave de assinatura

`C:\Users\Pedro\08_Seguranca\LaCalle\lacalle-life-release.jks`, com a senha em
`lacalle-life-keystore.txt` na mesma pasta. O projeto lê de
`android/keystore.properties` (fora do Git). **Sem essa chave não dá para
atualizar o app instalado nem publicar na Play Store com a mesma assinatura**:
precisa de cópia fora deste PC.

## Versões

| Versão | Data | O que mudou |
| --- | --- | --- |
| 1.0.0 (1) | 02/10/2026 | Primeira versão para instalar direto: abre o site oficial, ícone e abertura da marca, página afastada das barras do sistema. |
