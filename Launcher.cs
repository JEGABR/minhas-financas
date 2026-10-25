using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

namespace FinAIDesktop
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string indexPath = Path.Combine(baseDir, "index.html");

            if (!File.Exists(indexPath))
            {
                MessageBox.Show(
                    "O arquivo index.html não foi encontrado na pasta do aplicativo.",
                    "FinAI Desktop",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                return;
            }

            string fileUri = new Uri(indexPath).AbsoluteUri;

            string[] edgePaths = new string[]
            {
                @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                @"C:\Program Files\Microsoft\Edge\Application\msedge.exe"
            };

            foreach (string edgePath in edgePaths)
            {
                if (File.Exists(edgePath))
                {
                    ProcessStartInfo psi = new ProcessStartInfo
                    {
                        FileName = edgePath,
                        Arguments = string.Format("--app=\"{0}\" --window-size=1360,860", fileUri),
                        UseShellExecute = false
                    };
                    Process.Start(psi);
                    return;
                }
            }

            // Fallback caso o Edge não esteja no caminho padrão
            Process.Start(new ProcessStartInfo(indexPath) { UseShellExecute = true });
        }
    }
}

