# Solid 3D — Alpha 0.2

Protótipo experimental de modelagem de sólidos para impressão 3D, executado inteiramente no navegador.

## Recursos iniciais

- Desenhar retângulo ou círculo na mesa com mouse (perfil recebe espessura inicial de 1 mm).
- Empurrar/Puxar (atalho E): selecionar sólido e arrastar verticalmente para alterar a altura; edição exata em milímetros pela coluna Propriedades.
- Criar caixa ou cilindro, selecionar, editar dimensões e posição, duplicar, excluir.
- Vistas perspectiva, superior, frontal e lateral.
- Salvar/abrir projeto JSON e exportar STL.
- Mesa de referência Bambu A1 (256 × 256 mm).

## Publicação

Este é um site estático. Importe o repositório `Vdmtx/solid-3d` na Vercel como framework **Other**, diretório raiz `/`, sem comando de build. Alternativamente, habilite GitHub Pages na branch main e pasta `/ (root)` em Settings > Pages. Não exige instalação de programas pelo visitante, mas precisa de conexão com a internet para carregar Three.js via CDN.

## Limitações conhecidas

Alpha experimental, sem validação completa em navegadores. Extrusão inicial é alteração da altura de perfis retangulares/circulares, **não** extrusão de faces arbitrárias ou operações booleanas CAD. A altura por arrasto depende dos pixels movidos; medidas exatas devem ser inseridas no campo Altura. Massa é estimativa para PLA maciço. STL não inclui cores e deve ser revisado no fatiador. A exportação STL combina malhas sem união booleana.
