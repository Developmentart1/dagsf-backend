# Verificacion post-publicacion DAG SF
# Ejecutar despues de publish.sh

cd /Users/imac-ia/.openclaw/workspace/dagsf-backend

echo "--- Estado local ---"
git status -sb
git log --oneline -1
git remote -v

echo ""
echo "--- Archivos subidos (debe ser solo el proyecto) ---"
git ls-files

echo ""
echo "--- Repo remoto ---"
gh repo view Developmentart1/dagsf-backend --json name,visibility,url,defaultBranchRef

echo ""
echo "--- Chequeo de filtracion: si aparece algo de esto, HAY QUE CORREGIR ---"
git ls-files | grep -E "^(AGENTS|SOUL|USER|IDENTITY|MEMORY)\.md$|\.pdf$|\.doc$|\.xlsx$|\.clawhub|\.openclaw|telegram-bot|send-telegram|notas-miguel" && echo "!!! FUGA DETECTADA !!!" || echo "OK: sin archivos privados del workspace raiz"
