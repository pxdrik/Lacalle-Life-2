/**
 * Avisa quem está mostrando o perfil que o dado por baixo mudou, sem passar
 * por props nem por contexto — `ManualSyncButton` (em `app/`) e `useProfile`
 * (em `features/profile`) não têm nenhuma relação de árvore entre si, e
 * exigir uma teriam significado subir `useProfile` inteiro para a página só
 * para isso.
 *
 * Achado ao vivo (02/09/2026): `useProfile` lê o perfil uma vez, ao montar
 * — uma sincronização puxando uma versão nova por baixo não tinha como
 * chegar à tela, então o número ficava desatualizado mesmo depois de um
 * "Sincronizar dados" bem-sucedido. Isto é o jeito de avisar sem acoplar as
 * duas pontas: qualquer um chama `notifyProfileChanged()` depois de escrever
 * no repositório por fora do próprio `useProfile` (hoje, só o motor de
 * sync); qualquer um assina com `onProfileChanged` para saber quando reler.
 *
 * `notifyProfileChanged` espera todo assinante terminar de reler antes de
 * resolver — é o que permite `ManualSyncButton` manter a tela de
 * carregamento em pé até o número na tela já ser o novo, não só até a rede
 * responder.
 */
type Listener = () => Promise<void> | void;

const listeners = new Set<Listener>();

export function onProfileChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function notifyProfileChanged(): Promise<void> {
  await Promise.all([...listeners].map((listener) => listener()));
}
