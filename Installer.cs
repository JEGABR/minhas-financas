using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Windows.Forms;

namespace MinhasFinancasSetup
{
    public class SetupForm : Form
    {
        private TextBox txtInstallPath;
        private CheckBox chkDesktopShortcut;
        private CheckBox chkStartMenuShortcut;
        private CheckBox chkLaunchAfter;
        private ProgressBar progressBar;
        private Button btnInstall;
        private Button btnCancel;
        private Label lblStatus;

        public SetupForm()
        {
            Text = "Instalador — Minhas Finanças (Desktop)";
            Size = new Size(520, 390);
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.FromArgb(17, 24, 39);
            ForeColor = Color.FromArgb(248, 250, 252);
            Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);

            try
            {
                Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            }
            catch { }

            Panel headerPanel = new Panel
            {
                Dock = DockStyle.Top,
                Height = 76,
                BackColor = Color.FromArgb(9, 13, 22),
                Padding = new Padding(20, 14, 20, 14)
            };

            Label lblTitle = new Label
            {
                Text = "Minhas Finanças — Instalação no PC",
                Font = new Font("Segoe UI", 13f, FontStyle.Bold),
                ForeColor = Color.FromArgb(16, 185, 129),
                AutoSize = true,
                Location = new Point(20, 14)
            };

            Label lblSubtitle = new Label
            {
                Text = "Instale o painel de controle financeiro pessoal no seu computador.",
                Font = new Font("Segoe UI", 9f, FontStyle.Regular),
                ForeColor = Color.FromArgb(148, 163, 184),
                AutoSize = true,
                Location = new Point(20, 42)
            };

            headerPanel.Controls.Add(lblTitle);
            headerPanel.Controls.Add(lblSubtitle);
            Controls.Add(headerPanel);

            Label lblFolder = new Label
            {
                Text = "Pasta de destino da instalação:",
                AutoSize = true,
                Location = new Point(22, 92),
                ForeColor = Color.FromArgb(203, 213, 225)
            };
            Controls.Add(lblFolder);

            string defaultDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Programs",
                "MinhasFinancas"
            );

            txtInstallPath = new TextBox
            {
                Text = defaultDir,
                Location = new Point(22, 116),
                Size = new Size(365, 26),
                BackColor = Color.FromArgb(30, 41, 59),
                ForeColor = Color.White,
                BorderStyle = BorderStyle.FixedSingle
            };
            Controls.Add(txtInstallPath);

            Button btnBrowse = new Button
            {
                Text = "Procurar...",
                Location = new Point(395, 114),
                Size = new Size(88, 28),
                FlatStyle = FlatStyle.Flat,
                BackColor = Color.FromArgb(30, 41, 59),
                ForeColor = Color.White
            };
            btnBrowse.FlatAppearance.BorderColor = Color.FromArgb(71, 85, 105);
            btnBrowse.Click += (s, e) =>
            {
                using (FolderBrowserDialog fbd = new FolderBrowserDialog())
                {
                    fbd.SelectedPath = txtInstallPath.Text;
                    if (fbd.ShowDialog() == DialogResult.OK)
                    {
                        txtInstallPath.Text = Path.Combine(fbd.SelectedPath, "MinhasFinancas");
                    }
                }
            };
            Controls.Add(btnBrowse);

            chkDesktopShortcut = new CheckBox
            {
                Text = "Criar atalho na Área de Trabalho (Desktop)",
                Checked = true,
                AutoSize = true,
                Location = new Point(22, 158)
            };
            Controls.Add(chkDesktopShortcut);

            chkStartMenuShortcut = new CheckBox
            {
                Text = "Criar atalho no Menu Iniciar do Windows",
                Checked = true,
                AutoSize = true,
                Location = new Point(22, 186)
            };
            Controls.Add(chkStartMenuShortcut);

            chkLaunchAfter = new CheckBox
            {
                Text = "Abrir o Minhas Finanças ao concluir a instalação",
                Checked = true,
                AutoSize = true,
                Location = new Point(22, 214)
            };
            Controls.Add(chkLaunchAfter);

            lblStatus = new Label
            {
                Text = "Pronto para instalar.",
                AutoSize = true,
                Location = new Point(22, 250),
                ForeColor = Color.FromArgb(148, 163, 184)
            };
            Controls.Add(lblStatus);

            progressBar = new ProgressBar
            {
                Location = new Point(22, 272),
                Size = new Size(460, 18),
                Minimum = 0,
                Maximum = 100,
                Value = 0
            };
            Controls.Add(progressBar);

            btnCancel = new Button
            {
                Text = "Cancelar",
                Location = new Point(272, 306),
                Size = new Size(95, 34),
                FlatStyle = FlatStyle.Flat,
                BackColor = Color.FromArgb(30, 41, 59),
                ForeColor = Color.White,
                Cursor = Cursors.Hand
            };
            btnCancel.FlatAppearance.BorderColor = Color.FromArgb(71, 85, 105);
            btnCancel.Click += (s, e) => Close();
            Controls.Add(btnCancel);

            btnInstall = new Button
            {
                Text = "Instalar Agora",
                Location = new Point(377, 306),
                Size = new Size(106, 34),
                FlatStyle = FlatStyle.Flat,
                BackColor = Color.FromArgb(16, 185, 129),
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnInstall.FlatAppearance.BorderSize = 0;
            btnInstall.Click += BtnInstall_Click;
            Controls.Add(btnInstall);
        }

        private void ExtractResourceToFile(string resourceName, string targetPath)
        {
            Assembly asm = Assembly.GetExecutingAssembly();
            using (Stream s = asm.GetManifestResourceStream(resourceName))
            {
                if (s == null)
                {
                    throw new Exception("Recurso embutido não encontrado: " + resourceName);
                }
                using (FileStream fs = new FileStream(targetPath, FileMode.Create, FileAccess.Write))
                {
                    s.CopyTo(fs);
                }
            }
        }

        private void CreateShortcut(string shortcutPath, string targetExe, string workingDir, string iconPath)
        {
            Type shellType = Type.GetTypeFromProgID("WScript.Shell");
            if (shellType == null) return;
            object shell = Activator.CreateInstance(shellType);
            object shortcut = shellType.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { shortcutPath });
            Type scType = shortcut.GetType();
            scType.InvokeMember("TargetPath", BindingFlags.SetProperty, null, shortcut, new object[] { targetExe });
            scType.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, shortcut, new object[] { workingDir });
            scType.InvokeMember("IconLocation", BindingFlags.SetProperty, null, shortcut, new object[] { iconPath });
            scType.InvokeMember("Description", BindingFlags.SetProperty, null, shortcut, new object[] { "Minhas Finanças — Painel Financeiro Pessoal" });
            scType.InvokeMember("Save", BindingFlags.InvokeMethod, null, shortcut, null);
        }

        private void BtnInstall_Click(object sender, EventArgs e)
        {
            try
            {
                btnInstall.Enabled = false;
                string installDir = txtInstallPath.Text.Trim();
                Directory.CreateDirectory(installDir);

                lblStatus.Text = "Extraindo arquivos do aplicativo...";
                progressBar.Value = 25;
                Application.DoEvents();

                ExtractResourceToFile("index.html", Path.Combine(installDir, "index.html"));
                ExtractResourceToFile("styles.css", Path.Combine(installDir, "styles.css"));
                ExtractResourceToFile("app.js", Path.Combine(installDir, "app.js"));

                progressBar.Value = 65;
                Application.DoEvents();

                string exePath = Path.Combine(installDir, "MinhasFinancas.exe");
                string icoPath = Path.Combine(installDir, "app.ico");
                ExtractResourceToFile("MinhasFinancas.exe", exePath);
                ExtractResourceToFile("app.ico", icoPath);

                progressBar.Value = 85;
                lblStatus.Text = "Criando atalhos no sistema...";
                Application.DoEvents();

                if (chkDesktopShortcut.Checked)
                {
                    string desktopDir = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                    string lnk = Path.Combine(desktopDir, "Minhas Finanças.lnk");
                    CreateShortcut(lnk, exePath, installDir, icoPath);
                }

                if (chkStartMenuShortcut.Checked)
                {
                    string startMenuDir = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
                    string lnk = Path.Combine(startMenuDir, "Minhas Finanças.lnk");
                    CreateShortcut(lnk, exePath, installDir, icoPath);
                }

                progressBar.Value = 100;
                lblStatus.Text = "Instalação concluída com sucesso!";
                Application.DoEvents();

                MessageBox.Show(
                    "O aplicativo Minhas Finanças foi instalado com sucesso em:\n" + installDir,
                    "Instalação Concluída",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information
                );

                if (chkLaunchAfter.Checked && File.Exists(exePath))
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = exePath,
                        WorkingDirectory = installDir,
                        UseShellExecute = true
                    });
                }

                Close();
            }
            catch (Exception ex)
            {
                btnInstall.Enabled = true;
                MessageBox.Show(
                    "Erro durante a instalação: " + ex.Message,
                    "Erro no Instalador",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
        }

        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new SetupForm());
        }
    }
}

