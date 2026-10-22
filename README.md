# Solid 3D — Alpha 2.0

Protótipo experimental de modelagem de sólidos e objetos para impressão 3D, no navegador. Interface inspirada no CorelDRAW, com perspectiva, ferramentas 2D e modelagem 3D apoiada em Three.js. Mesa padrão Bambu Lab A1: **256 × 256 mm**.

**Aviso:** este protótipo não é um CAD paramétrico completo, nem garante que cada STL exportado seja uma malha estanque ou esteja pronto para impressão.

## Recursos disponíveis

- Criação de caixa, cilindro, esfera, cone, prisma, pirâmide, toro, perfis 2D e contornos Bézier.
- Empurrar/Puxar simples, dimensões e posição em milímetros, vistas de perspectiva/topo/frontal/lateral.
- Seleção visual e pintura de faces. Selecionar um grupo de face **não** permite subdivisão livre de qualquer malha.
- Primeira subdivisão reta, repetível, na **face superior de caixas simples**; internamente, a região é transformada em peças independentes.
- Primeira extrusão adicional **da face inteira** de caixas simples por CSG (não confundir com extrusão de uma região desenhada dentro da face).
- Soldar, Aparar e Interseção por biblioteca CSG: selecione o primeiro objeto, depois Ctrl+clique no segundo; operações ainda exigem validação de qualidade de malha.
- Inclinar por vértice de caixa simples via deslocamentos X/Y/Z numéricos. Ainda **não** há arraste livre nem seleção exata de vértice pela distância ao ponteiro.
- Arredondamento, chanfro e cavidade nas formas compatíveis.
- Texto 2D/3D, fontes externas, contorno de texto e imagem de referência JPG/PNG.
- Temas escuro/claro/cinza para interface e viewport 3D; português e inglês **parcial**.
- Paletas visuais de filamento para Bambu Lab e Polymaker. As cores não são garantia colorimétrica.
- Salvar/abrir JSON (formato de projeto v3), incluindo malhas CSG, deformações e imagem de referência. Exportação de STL binário **sem cores**.
- Desfazer/Refazer para as alterações de objeto incorporadas ao histórico.

## Limitações conhecidas

- Divisão em qualquer face, corte arbitrário (linha/círculo/retângulo) e extrusão de regiões internas **não implementados**.
- Não há sistema completo de edição de arestas/vértices, nem operação paramétrica reversível de solda, corte e interseção.
- STL exportado não passa por validação topológica de estanqueidade, interseções, espessura mínima ou normais.
- Importação de STL, 3MF, perfis de fatiamento e recursos específicos de resina não estão implementados.
- O botão de desbloquear imagem não habilita sua movimentação: é uma função ainda pendente.
- Nem todas as mensagens foram traduzidas ao inglês.
- Algumas combinações de acabamentos, cavidades e inclinações não são suportadas; o editor deve exibir aviso em vez de modificar a peça.
- Dependência de internet para bibliotecas de Three.js, CSG e fontes.
- Recursos além dos casos cobertos pelos testes automatizados requerem testes manuais.

## Testes

- Verificação estática: `node tests/check.mjs` (sintaxe do módulo após separar imports de CDN, referências da interface e invariantes conhecidos).
- Verificação em navegador: `node tests/browser.mjs` com Playwright/Chromium instalado. Cria peças, usa a interface, salva/abre JSON e confere a estrutura de STL binário.
- O GitHub Actions executa esses testes em cada alteração. **Passar em testes não atesta que um STL está apto para impressão.** Confira o modelo no fatiador e valide a geometria.

## Publicação

Site estático, sem build obrigatório: conectar o repositório `Vdmtx/solid-3d` à Vercel como framework **Other**, diretório raiz `/`, sem comando de build. Alternativamente, usar GitHub Pages na branch `main`, pasta `/ (root)`. Internet necessária para as dependências importadas por CDN.

## Princípio de evolução

Manter o identificador visual **Alpha 2.0** até a validação de um conjunto significativo de funcionalidades. Não anunciar uma função como concluída apenas porque o botão ou o código foi publicado: registrar o teste executado e suas limitações.
