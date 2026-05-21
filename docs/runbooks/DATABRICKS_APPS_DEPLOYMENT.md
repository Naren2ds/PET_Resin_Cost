# Databricks Apps Deployment

This branch prepares the PET Resin Cost Platform to deploy from GitHub into Databricks Apps.

## Local Validation

From the repository root:

```powershell
npm install
npm run build
pip install -r requirements.txt
$env:DATABRICKS_APP_PORT = "8000"
uvicorn main:app --app-dir apps/backend --host 0.0.0.0 --port $env:DATABRICKS_APP_PORT
```

Then open:

```text
http://127.0.0.1:8000
http://127.0.0.1:8000/health
```

For local frontend development, run the backend on port 8000 and use the existing frontend command:

```powershell
cd apps/frontend
npm install
npm run dev
```

Vite proxies `/countries`, `/market-research-trends`, and `/health` to the local backend.

## GitHub Flow

Push this branch:

```powershell
git push -u origin databricks-app-deployment
```

Open a pull request into `main`. After merge, deploy the Databricks app from the `main` branch.

## Databricks App Settings

Use the repository root as the source code path. The app needs these root files:

- `app.yaml`: starts uvicorn on `${DATABRICKS_APP_PORT}`.
- `requirements.txt`: installs Python dependencies.
- `package.json`: installs Node dependencies and builds the React frontend.

Deploy from Git:

```text
Git repository: https://github.com/Naren2ds/PET_Resin_Cost.git
Git reference: main
Reference type: branch
Source code path: blank / repository root
```

If the repository is private, configure the app service principal Git credential before deployment.
