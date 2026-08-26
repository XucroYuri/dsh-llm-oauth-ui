import pathlib
import tempfile
import unittest

from dsh_llm_oauth_ui import cmd_status, load_credentials

class OAuthUiTests(unittest.TestCase):
    def test_load_missing(self):
        with tempfile.TemporaryDirectory() as td:
            self.assertEqual(load_credentials(pathlib.Path(td)), {})

    def test_status_with_grant(self):
        with tempfile.TemporaryDirectory() as td:
            home = pathlib.Path(td)
            (home / ".credentials.yaml").write_text(
                "version: 1\nrecords:\n  llm-pi-ai/openai:\n    kind: grant\n    payload: {}\n",
                encoding="utf-8",
            )
            # Should not raise and should report openai configured.
            self.assertEqual(cmd_status(home), 0)

if __name__ == "__main__":
    unittest.main()
