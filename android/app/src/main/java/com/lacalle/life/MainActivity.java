package com.lacalle.life;

import android.content.res.Configuration;
import android.os.Bundle;
import android.view.View;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * O app é o site oficial dentro de um WebView (capacitor.config.ts). Com o
 * Android 15 o app desenha por baixo da barra de status e da de navegação, e
 * o site não reserva espaço no topo para isso: o cabeçalho ficaria embaixo do
 * relógio. Em vez de mudar o site, a página é afastada das barras do sistema,
 * do recorte da câmera e do teclado aqui, igual em todas as versões do
 * Android; atrás das barras fica o fundo do app (`app_canvas`).
 *
 * Os ícones da barra de status seguem o tema do aparelho: o fundo atrás dela
 * é o do tema do aparelho, não o escolhido dentro do app.
 */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        View content = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(content, (view, insets) -> {
            Insets edges = insets.getInsets(
                WindowInsetsCompat.Type.systemBars()
                    | WindowInsetsCompat.Type.displayCutout()
                    | WindowInsetsCompat.Type.ime()
            );
            view.setPadding(edges.left, edges.top, edges.right, edges.bottom);
            // Consumidas: o site recebe `env(safe-area-inset-*)` zerado e não
            // soma uma segunda margem à de baixo.
            return WindowInsetsCompat.CONSUMED;
        });
        followDeviceTheme(getResources().getConfiguration());
    }

    /** `uiMode` está em `configChanges`: trocar o tema não recria a tela. */
    @Override
    public void onConfigurationChanged(Configuration configuration) {
        super.onConfigurationChanged(configuration);
        followDeviceTheme(configuration);
    }

    private void followDeviceTheme(Configuration configuration) {
        boolean dark = (configuration.uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setAppearanceLightStatusBars(!dark);
        controller.setAppearanceLightNavigationBars(!dark);
    }
}
